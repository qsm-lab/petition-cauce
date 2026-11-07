"""hardening-campana T2.4: el contexto RLS no puede sobrevivir al devolver la conexión al pool.

Antes del arreglo, `set_config(..., false)` (nivel de sesión) de un admin o de un job quedaba en la
conexión y la heredaba la petición siguiente (pool de tamaño 1 = reutilización garantizada).
"""
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app import database
from app.config import settings

ORG = "11111111-1111-1111-1111-111111111111"


@pytest.fixture
async def sesion_pool_unico():
    """Mismo motor y mismos listeners de producción, pero con UNA sola conexión."""
    eng = create_async_engine(settings.database_url, pool_size=1, max_overflow=0)
    database.install_pool_context_reset(eng)
    yield async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)
    await eng.dispose()


async def _contexto(S):
    async with S() as s:
        r = (await s.execute(text(
            "select current_setting('app.is_platform_admin', true), "
            "current_setting('app.current_org_id', true)"))).one()
        return tuple(r)


def _vacio(valor):
    return valor in (None, "")


async def test_contexto_tras_commit_no_se_hereda(sesion_pool_unico):
    S = sesion_pool_unico
    async with S() as a:
        await a.execute(text("SELECT set_config('app.current_org_id', :o, false)"), {"o": ORG})
        await a.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        await a.commit()
    admin, org = await _contexto(S)
    assert _vacio(admin) and _vacio(org)


async def test_contexto_tras_commits_intermedios_y_error(sesion_pool_unico):
    S = sesion_pool_unico
    with pytest.raises(RuntimeError):
        async with S() as a:
            await a.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
            await a.commit()
            await a.execute(text("SELECT set_config('app.current_org_id', :o, false)"), {"o": ORG})
            await a.commit()
            await a.execute(text("SELECT 1"))
            raise RuntimeError("falla a mitad de la petición")
    admin, org = await _contexto(S)
    assert _vacio(admin) and _vacio(org)


async def test_contexto_tras_transaccion_abortada(sesion_pool_unico):
    S = sesion_pool_unico
    async with S() as a:
        await a.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        await a.commit()
        with pytest.raises(Exception):
            await a.execute(text("SELECT 1/0"))   # deja la transacción abortada
    admin, org = await _contexto(S)
    assert _vacio(admin) and _vacio(org)


async def test_el_motor_de_la_app_tambien_limpia():
    """El motor real (`app.database.engine`) lleva el mismo listener."""
    async with database.AsyncSessionLocal() as a:
        await a.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        await a.commit()
    # Sin garantizar qué conexión se reutiliza: se agota el pool hasta ver todas limpias.
    for _ in range(3):
        async with database.AsyncSessionLocal() as b:
            v = (await b.execute(text("select current_setting('app.is_platform_admin', true)"))).scalar()
            assert _vacio(v)


async def test_set_rls_context_sobrevive_al_commit_en_la_misma_sesion(sesion_pool_unico):
    """El contexto de sesión se re-aplica en cada transacción, pero no queda en la conexión."""
    S = sesion_pool_unico
    async with S() as s:
        await database.set_rls_context(s, org_id=ORG, platform_admin=True)
        q = text("select current_setting('app.is_platform_admin', true), current_setting('app.current_org_id', true)")
        assert tuple((await s.execute(q)).one()) == ("true", ORG)
        await s.commit()  # la conexión vuelve al pool y se limpia
        assert tuple((await s.execute(q)).one()) == ("true", ORG)  # nueva transacción: re-aplicado
    assert all(_vacio(v) for v in await _contexto(S))
