#!/usr/bin/env bash
# hardening-campana T2.2 — prueba de restauración en una base TEMPORAL (no toca petition_cause).
# Uso: restore_test.sh <respaldo.dump.age> <identidad-privada-age.txt>
# La identidad privada se pasa en el momento; no debe quedar guardada en el VPS.
set -euo pipefail
file="${1:?uso: restore_test.sh <respaldo.dump.age> <identidad.txt>}"
identity="${2:?falta la identidad privada de age}"
DB_CONTAINER="${DB_CONTAINER:-petition-db}"
DB_USER="${DB_USER:-petition_admin}"
TMP_DB="petition_restore_test"

start=$(date +%s)
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $TMP_DB" >/dev/null
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $TMP_DB" >/dev/null

age -d -i "$identity" "$file" \
  | docker exec -i "$DB_CONTAINER" pg_restore -U "$DB_USER" -d "$TMP_DB" --no-owner --exit-on-error

echo "== filas restauradas"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$TMP_DB" -At -c "
  select 'signatures='||count(*) from signatures;
  select 'campaigns='||count(*) from campaigns;
  select 'consents='||count(*) from consents;
  select 'alembic='||version_num from alembic_version;"
echo "== original"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d petition_cause -At -c "
  select 'signatures='||count(*) from signatures;
  select 'campaigns='||count(*) from campaigns;"

docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE $TMP_DB" >/dev/null
echo "RTO medido: $(( $(date +%s) - start )) s (anotarlo en runbook_backup_restore.md)"
