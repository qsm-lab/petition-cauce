#!/bin/bash
# Inicialización de usuarios de la BD — se ejecuta una sola vez al crear el volumen.
# Docker postgres corre scripts .sh en docker-entrypoint-initdb.d/ con acceso a env vars.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Usuario de servicio: no superusuario → RLS efectivo en runtime
    CREATE USER petition_app WITH PASSWORD '${PETITION_APP_PASSWORD}';

    GRANT CONNECT ON DATABASE petition_cause TO petition_app;
    GRANT USAGE ON SCHEMA public TO petition_app;

    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO petition_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO petition_app;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO petition_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO petition_app;
EOSQL
