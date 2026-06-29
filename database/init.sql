-- init.sql — proy_petition-cauce
-- Se ejecuta una sola vez al inicializar el contenedor PostgreSQL.
-- Crea el usuario de servicio petition_app como NO superusuario,
-- lo que hace que RLS sea efectivo tanto en dev como en producción.

-- Usuario de servicio: acceso restringido, no superusuario → RLS activo
CREATE USER petition_app WITH PASSWORD 'apppassword_change_in_env';

-- Permisos sobre el schema public (la BD ya se llama petition_cause)
GRANT CONNECT ON DATABASE petition_cause TO petition_app;
GRANT USAGE ON SCHEMA public TO petition_app;

-- Permisos sobre tablas existentes y futuras
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO petition_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO petition_app;

-- Permisos sobre tablas creadas en el futuro (Alembic)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO petition_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO petition_app;
