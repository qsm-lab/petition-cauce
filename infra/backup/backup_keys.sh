#!/usr/bin/env bash
# hardening-campana T2.3 — copia CIFRADA de las claves críticas del .env.
# No imprime ningún valor (solo si cada clave tiene valor y su longitud).
# Uso: backup_keys.sh /ruta/.env /etc/petition-backup/recipients.txt salida.age
set -euo pipefail
env_file="${1:?ruta del .env}"; recipients="${2:?archivo de destinatarios age}"; out="${3:?archivo de salida .age}"
umask 077
keys="PII_ENCRYPTION_KEY HMAC_SECRET_KEY PROVIDER_SECRET_KEY JWT_SECRET_KEY"
pattern="^($(echo "$keys" | tr ' ' '|'))="

grep -E "$pattern" "$env_file" | age -R "$recipients" > "$out"

with_value=0
for k in $keys; do
  line=$(grep -E "^${k}=" "$env_file" | tail -1 || true)
  val=${line#*=}; val=$(printf '%s' "$val" | tr -d "\"' \t\r")
  if [ -n "$val" ]; then
    echo "  $k: con valor (longitud ${#val})"; with_value=$((with_value + 1))
  else
    echo "  $k: VACIA o ausente"
  fi
done
echo "Claves cifradas en $out ($with_value de 4 con valor)"
[ "$with_value" -eq 4 ] || echo "AVISO: faltan claves con valor; el respaldo está incompleto para las vacías."
