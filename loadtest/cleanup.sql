-- Limpieza de datos sintéticos de las pruebas de carga (SOLO staging).
-- Los correos están cifrados; los registros se identifican por el nombre "LoadTest ...".
-- Uso: docker exec -i petition-db-staging psql -U petition_admin -d petition_cause -f - < loadtest/cleanup.sql
BEGIN;
SELECT set_config('app.is_platform_admin', 'true', true);
DELETE FROM consents WHERE signature_id IN (SELECT id FROM signatures WHERE name LIKE 'LoadTest %');
DELETE FROM signatures WHERE name LIKE 'LoadTest %';
COMMIT;
