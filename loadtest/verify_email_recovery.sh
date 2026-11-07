#!/usr/bin/env bash
# Comprueba la recuperación del correo de confirmación tras una carga (entorno aislado lt-*).
# Espera a que el loop procese lo pendiente y resume los estados. Solo conteos, sin datos personales.
# Uso: bash loadtest/verify_email_recovery.sh [segundos-máximo-de-espera]
set -euo pipefail
MAX="${1:-300}"
q() { docker exec lt-db psql -U petition_admin -d petition_cause -At -c "$1"; }
echo "== estados al terminar la carga"
q "select confirmation_email_status, count(*) from signatures where email_hash is not null and not is_test group by 1 order by 1"
start=$(date +%s)
while :; do
  open=$(q "select count(*) from signatures where confirmation_email_status in ('pending','sending','failed')")
  [ "$open" -eq 0 ] && break
  [ $(( $(date +%s) - start )) -ge "$MAX" ] && { echo "TIMEOUT: quedan $open sin cerrar tras ${MAX}s"; break; }
  sleep 5
done
echo "== estados finales"
q "select confirmation_email_status, count(*) from signatures group by 1 order by 1"
echo "== reintentos (firmas con más de 1 intento) y tope"
q "select count(*) filter (where confirmation_email_attempts > 1) as con_reintentos,
          max(confirmation_email_attempts) as max_intentos,
          count(*) filter (where confirmation_email_status = 'gave_up') as gave_up from signatures"
echo "== firmas con envío > 60 s tras el alta (entre las enviadas)"
q "select count(*) filter (where confirmation_email_sent_at - created_at > interval '60 seconds'),
          round(avg(extract(epoch from (confirmation_email_sent_at - created_at)))::numeric, 1)
   from signatures where confirmation_email_status = 'sent' and confirmation_email_sent_at is not null"
