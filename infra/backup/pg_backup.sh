#!/usr/bin/env bash
# hardening-campana T2.2 — respaldo cifrado (horario/diario) de petition-db.
# Corre en el VPS (cron). Cifra con `age` (clave PÚBLICA en el VPS; la privada vive fuera).
# Variables opcionales: BACKUP_DIR, AGE_RECIPIENTS, RETENTION_DAYS, OFFSITE_REMOTE (remoto rclone).
set -euo pipefail
# cron arranca con PATH=/usr/bin:/bin: sin esto no vería un rclone instalado en /usr/local/bin.
export PATH="/usr/local/bin:$PATH"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/petition}"
AGE_RECIPIENTS="${AGE_RECIPIENTS:-/etc/petition-backup/recipients.txt}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
OFFSITE_REMOTE="${OFFSITE_REMOTE:-}"
DB_CONTAINER="${DB_CONTAINER:-petition-db}"
DB_USER="${DB_USER:-petition_admin}"
DB_NAME="${DB_NAME:-petition_cause}"

umask 077
mkdir -p "$BACKUP_DIR"
ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/petition_cause_${ts}.dump.age"

docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc \
  | age -R "$AGE_RECIPIENTS" > "$out.tmp"

# Un respaldo vacío o truncado no cuenta como respaldo.
size=$(stat -c %s "$out.tmp" 2>/dev/null || stat -f %z "$out.tmp")
if [ "$size" -lt 10240 ]; then
  echo "ERROR: respaldo sospechosamente pequeño (${size} bytes)" >&2
  rm -f "$out.tmp"; exit 1
fi
mv "$out.tmp" "$out"
sha256sum "$out" > "$out.sha256" 2>/dev/null || shasum -a 256 "$out" > "$out.sha256"

if [ -n "$OFFSITE_REMOTE" ]; then
  # `copyto` (ruta exacta del objeto): `copy` hacia un prefijo recibía un 501 de R2 en el primer intento.
  rclone copyto "$out" "$OFFSITE_REMOTE/$(basename "$out")" --quiet
  rclone copyto "$out.sha256" "$OFFSITE_REMOTE/$(basename "$out").sha256" --quiet
fi

# Retención local (la del remoto se define con una regla de ciclo de vida del bucket).
find "$BACKUP_DIR" -name 'petition_cause_*.dump.age*' -mtime +"$RETENTION_DAYS" -delete

# Marca para el monitor de señales de negocio (backup al día).
date -u +%s > "$BACKUP_DIR/LAST_OK"
echo "OK $out (${size} bytes)"
