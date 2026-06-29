# migrations/env.py
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Importar todos los modelos para que Alembic pueda detectar cambios de schema
from app.models.base import Base
from app.models import *  # noqa: F401 — necesario para que los modelos se registren

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# El metadata de todos los modelos — Alembic lo usa para comparar contra la DB
target_metadata = Base.metadata

def get_url() -> str:
    # Alembic siempre usa la URL síncrona (psycopg2), nunca asyncpg
    url = os.environ.get("DATABASE_URL_SYNC")
    if not url:
        raise ValueError(
            "DATABASE_URL_SYNC no está definida en el entorno. "
            "Verificar que el archivo .env.dev existe y tiene esta variable."
        )
    return url

def run_migrations_offline() -> None:
    """Modo offline: genera SQL sin conectarse a la DB."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Modo online: se conecta a la DB y aplica las migraciones directamente."""
    # engine_from_config es SÍNCRONO — correcto para Alembic
    connectable = engine_from_config(
        {"sqlalchemy.url": get_url()},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # NullPool: no reutilizar conexiones en migraciones
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()