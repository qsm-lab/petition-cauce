#!/usr/bin/env bash
# hardening-campana T3.4 — señales de negocio y capacidad (corre en el VPS, cron cada 5 min).
# Avisa por correo con un SMTP INDEPENDIENTE de Resend/Brevo (para que un cupo agotado no silencie
# las alertas). No incluye PII: solo conteos.
# Config en /etc/petition-monitor.env (modo 600):
#   SMTP_URL="smtps://mail.tu-hosting.com:465"   SMTP_USER=...   SMTP_PASS=...
#   ALERT_FROM="monitor@tu-dominio.ec"           ALERT_TO="guardia1@correo.ec guardia2@correo.ec"
#   BACKUP_DIR=/var/backups/petition             (opcional)
set -u
# shellcheck disable=SC1090
source "${PETITION_MONITOR_ENV:-/etc/petition-monitor.env}"
case "${SMTP_URL:-}" in
  smtp://*|smtps://*) ;;
  *) echo "business_signals: SMTP_URL debe empezar por smtps:// o smtp:// (sin esquema curl usa HTTP y no envía)" >&2; exit 2 ;;
esac
STATE_DIR="${STATE_DIR:-/var/lib/petition-monitor}"
DB_CONTAINER="${DB_CONTAINER:-petition-db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/petition}"
MEM_WARN="${MEM_WARN:-75}"; MEM_CRIT="${MEM_CRIT:-90}"   # % de memoria del host (se baja a 1 para probar el envío de alertas)
REPEAT_MIN="${REPEAT_MIN:-60}"   # no repetir la misma alerta antes de estos minutos
mkdir -p "$STATE_DIR"

alert() {  # $1 id, $2 nivel, $3 mensaje
  local stamp="$STATE_DIR/$1.last" now last; now=$(date +%s); last=$(cat "$stamp" 2>/dev/null || echo 0)
  [ $(( (now - last) / 60 )) -lt "$REPEAT_MIN" ] && return 0
  echo "$now" > "$stamp"
  local body; body=$(printf 'From: %s\nSubject: [Cauce][%s] %s\nMIME-Version: 1.0\nContent-Type: text/plain; charset=UTF-8\n\n%s\n(host: %s, %s)\n' \
    "$ALERT_FROM" "$2" "$1" "$3" "$(hostname)" "$(date -u +%FT%TZ)")
  local rcpt=(); for to in $ALERT_TO; do rcpt+=(--mail-rcpt "$to"); done
  printf '%s' "$body" | curl -sS --ssl-reqd --url "$SMTP_URL" --user "$SMTP_USER:$SMTP_PASS" \
    --mail-from "$ALERT_FROM" "${rcpt[@]}" -T - >/dev/null 2>&1 || echo "no se pudo enviar alerta $1" >&2
}

q() { docker exec "$DB_CONTAINER" psql -U petition_admin -d petition_cause -At -c "$1" 2>/dev/null; }

# 1) Tasa de confirmación: firmas (2 h) aún sin confirmar tras 15 min.
# Línea base real (campaña anterior, 2 373 firmas): ~52 % confirma, ~48 % no, estable semana a semana. Por eso
# los umbrales son ALTOS: solo saltan si casi nadie confirma (correo roto). "Correo atascado" lo cubre el bloque 1b.
read -r pend total <<<"$(q "select count(*) filter (where status='pending_confirmation' and created_at < now()-interval '15 minutes'),
                                   count(*) from signatures where created_at > now()-interval '2 hours' and not is_test" | tr '|' ' ')"
pend=${pend:-0}; total=${total:-0}
if [ "$total" -ge 20 ]; then
  pct=$(( 100 * pend / total ))
  [ "$pct" -ge 90 ] && alert pending_confirmacion CRITICO "$pend de $total firmas (2 h) sin confirmar tras 15 min (${pct} %). Casi nadie confirma: revisar correo transaccional."
  [ "$pct" -ge 75 ] && [ "$pct" -lt 90 ] && alert pending_confirmacion AVISO "$pend de $total firmas (2 h) sin confirmar tras 15 min (${pct} %); la línea base ronda 50-60 %."
fi

# 1b) Correo de confirmación (correo-recuperacion): se rindieron (gave_up) o llevan > 10 min sin salir
read -r gave stuck <<<"$(q "select count(*) filter (where confirmation_email_status='gave_up'),
  count(*) filter (where confirmation_email_status in ('pending','failed','sending') and created_at < now()-interval '10 minutes')
  from signatures where status='pending_confirmation'" | tr '|' ' ')"
gave=${gave:-0}; stuck=${stuck:-0}
[ "$gave" -gt 0 ] && alert correo_gave_up CRITICO "$gave firmas sin correo de confirmación tras agotar los reintentos. Revisar proveedor/cuota; el firmante puede pedir reenvío."
[ "$stuck" -ge 50 ] && alert correo_atascado CRITICO "$stuck correos de confirmación con más de 10 min sin salir (proveedor caído o cupo agotado)."
[ "$stuck" -ge 10 ] && [ "$stuck" -lt 50 ] && alert correo_atascado AVISO "$stuck correos de confirmación con más de 10 min sin salir."

# 2) Cola de comunicaciones: lotes pendientes y lotes atascados en 'sending'
backlog=$(q "select count(*) from send_batch where status='pending'"); backlog=${backlog:-0}
[ "$backlog" -gt 5000 ] && alert cola_backlog CRITICO "Backlog de lotes pendientes: $backlog."
stuck=$(q "select count(*) from send_batch b join scheduled_send s on s.id=b.scheduled_send_id
           where b.status='sending' and s.updated_at < now()-interval '10 minutes'"); stuck=${stuck:-0}
[ "$stuck" -gt 0 ] && alert cola_atascada CRITICO "$stuck lote(s) en 'sending' sin avance > 10 min. Ver runbook_colas_asincronas_email.md."

# 2b) Errores 5xx de la API en los últimos 5 min (logs estructurados sin PII, app/observability.py)
logs5=$(docker logs --since 5m petition-api 2>&1 | grep '"event":"http"' || true)
total5=$(printf '%s\n' "$logs5" | grep -c '"event":"http"' || true)
err5=$(printf '%s\n' "$logs5" | grep -c '"status":5' || true)
total5=${total5:-0}; err5=${err5:-0}
if [ "$total5" -ge 20 ]; then
  pct5=$(( 100 * err5 / total5 ))
  [ "$pct5" -ge 5 ] && alert errores_5xx CRITICO "${err5} de ${total5} peticiones con 5xx en 5 min (${pct5} %)." \
    || { [ "$pct5" -ge 1 ] && alert errores_5xx AVISO "${err5} de ${total5} peticiones con 5xx en 5 min (${pct5} %)."; }
elif [ "$err5" -ge 10 ]; then
  alert errores_5xx CRITICO "${err5} errores 5xx en 5 min (poco tráfico)."
fi

# 2c) Exportaciones de PII fuera de lo normal (> 3 en 1 h)
exports=$(q "select count(*) from pii_export_audit where created_at > now()-interval '1 hour'"); exports=${exports:-0}
[ "$exports" -gt 3 ] && alert exportaciones_pii AVISO "$exports exportaciones de PII en la última hora. Verificar con los administradores."

# 3) Respaldo al día (< 26 h)
if [ -f "$BACKUP_DIR/LAST_OK" ]; then
  age_h=$(( ( $(date +%s) - $(cat "$BACKUP_DIR/LAST_OK") ) / 3600 ))
  [ "$age_h" -ge 26 ] && alert backup_atrasado CRITICO "Último respaldo correcto hace ${age_h} h."
else
  alert backup_atrasado CRITICO "No hay marca de respaldo ($BACKUP_DIR/LAST_OK)."
fi

# 4) Disco y memoria
disk=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "$disk" -ge 85 ] && alert disco CRITICO "Disco al ${disk} %." || { [ "$disk" -ge 70 ] && alert disco AVISO "Disco al ${disk} %."; }
mem=$(free | awk '/Mem:/ {printf "%d", $3*100/$2}')
[ "$mem" -ge "$MEM_CRIT" ] && alert memoria CRITICO "Memoria del host al ${mem} %." || { [ "$mem" -ge "$MEM_WARN" ] && alert memoria AVISO "Memoria del host al ${mem} %."; }

# 5) Contenedores de petition caídos o reiniciándose
for c in petition-api petition-web petition-db petition-redis; do
  st=$(docker inspect -f '{{.State.Status}} {{.RestartCount}}' "$c" 2>/dev/null || echo "ausente 0")
  case "$st" in running*) ;; *) alert "contenedor_$c" CRITICO "$c: estado '$st'.";; esac
done
