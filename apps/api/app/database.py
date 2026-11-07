import logging

from sqlalchemy import event, text
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout,
    pool_recycle=1800,
)

logger = logging.getLogger(__name__)

# Parámetros de contexto RLS que la app fija a nivel de sesión de BD (set_config(..., false)) en
# `get_db_with_org` y en los jobs de fondo. Persisten en la conexión física: sin limpiarlos, la
# petición siguiente que reutilice la conexión hereda la organización o el rol de plataforma anteriores.
_RLS_CONTEXT_PARAMS = ("app.current_org_id", "app.is_platform_admin")


def install_pool_context_reset(async_engine) -> None:
    """Limpia el contexto RLS cada vez que una conexión vuelve al pool (hardening-campana T2.4)."""

    @event.listens_for(async_engine.sync_engine, "checkin")
    def _reset_rls_context(dbapi_connection, connection_record):
        if dbapi_connection is None:  # conexión invalidada
            return
        try:
            cursor = dbapi_connection.cursor()
            for param in _RLS_CONTEXT_PARAMS:
                cursor.execute(f"RESET {param}")
            cursor.close()
            dbapi_connection.commit()  # un RESET dentro de una transacción revertida se desharía
        except Exception:
            # Una conexión que no se pudo limpiar no puede reutilizarse: se descarta.
            logger.exception("pool: no se pudo limpiar el contexto RLS; se invalida la conexión")
            connection_record.invalidate()


install_pool_context_reset(engine)

_UNSET = object()
_RLS_INFO_KEY = "rls_context"


async def set_rls_context(session: AsyncSession, *, org_id=_UNSET, platform_admin=_UNSET) -> None:
    """Fija el contexto RLS de ESTA sesión (hardening-campana T2.4).

    El contexto vive en `session.info` y se re-aplica, con `set_config(..., is_local=true)`, al comenzar
    cada transacción de la sesión. Así sobrevive a los `commit()` (que devuelven la conexión al pool y
    pueden entregar otra distinta en la consulta siguiente) y nunca queda en la conexión física.
    `org_id=None` equivale a "sin organización". Se aplica de inmediato a la transacción en curso.
    """
    info = session.sync_session.info.setdefault(_RLS_INFO_KEY, {})
    if org_id is not _UNSET:
        info["org_id"] = None if org_id is None else str(org_id)
    if platform_admin is not _UNSET:
        info["platform_admin"] = bool(platform_admin)
    if session.in_transaction():
        await session.execute(text("SELECT 1"))  # asegura la transacción abierta y su conexión
        conn = await session.connection()
        await conn.run_sync(lambda sync_conn: _apply_rls_context(sync_conn, info))


def _apply_rls_context(connection, ctx: dict) -> None:
    if "org_id" in ctx:
        connection.execute(text("SELECT set_config('app.current_org_id', :v, true)"), {"v": ctx["org_id"] or ""})
    if "platform_admin" in ctx:
        connection.execute(
            text("SELECT set_config('app.is_platform_admin', :v, true)"),
            {"v": "true" if ctx["platform_admin"] else "false"},
        )


@event.listens_for(Session, "after_begin")
def _apply_rls_context_on_begin(session, transaction, connection):
    ctx = session.info.get(_RLS_INFO_KEY)
    if ctx:
        _apply_rls_context(connection, ctx)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def check_db_health() -> bool:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(__import__("sqlalchemy").text("SELECT 1"))
        return True
    except Exception:
        return False
