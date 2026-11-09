#!/usr/bin/env bash
# hardening-campana T3.4 — chequeo de disponibilidad EXTERNO (corre en el hosting compartido
# de GreenGeeks, fuera del VPS). Cron cada 5 min:  */5 * * * * $HOME/petition-monitor/healthcheck_remote.sh
# Avisa por correo tras 2 fallos seguidos y cuando se recupera. No registra PII.
# Config en ~/.petition-monitor.env:
#   ALERT_TO="guardia1@correo.ec guardia2@correo.ec"
#   ALERT_FROM="monitor@tu-dominio.ec"
#   CHECK_URLS="https://cauce.ecuadornotlc.org/api/health https://cauce.ecuadornotlc.org/"
set -u
# shellcheck disable=SC1090
source "${PETITION_MONITOR_ENV:-$HOME/.petition-monitor.env}"
STATE_DIR="${STATE_DIR:-$HOME/.petition-monitor}"
mkdir -p "$STATE_DIR"

send_mail() {  # $1 asunto, $2 cuerpo — sendmail del hosting (independiente de Resend/Brevo)
  for to in $ALERT_TO; do
    printf 'From: %s\nTo: %s\nSubject: %s\nMIME-Version: 1.0\nContent-Type: text/plain; charset=UTF-8\n\n%s\n' "$ALERT_FROM" "$to" "$1" "$2" | "${SENDMAIL:-/usr/sbin/sendmail}" -t
  done
}

for url in $CHECK_URLS; do
  key="$(printf '%s' "$url" | tr -c 'A-Za-z0-9' '_')"
  f="$STATE_DIR/$key.fails"
  body="$STATE_DIR/$key.body"
  code="$(curl -sS -o "$body" -m 15 -w '%{http_code}' "$url" 2>/dev/null || echo 000)"
  # /api/health responde 200 aun en estado "degraded" (BD o Redis caídos): exigir "status":"ok".
  case "$url" in */health) grep -q '"status":"ok"' "$body" 2>/dev/null || code=503;; esac
  fails="$(cat "$f" 2>/dev/null || echo 0)"
  if [ "$code" -ge 200 ] 2>/dev/null && [ "$code" -lt 400 ]; then
    if [ "$fails" -ge 2 ]; then
      send_mail "[Cauce] RECUPERADO: $url" "Responde $code de nuevo ($(date -u +%FT%TZ))."
    fi
    echo 0 > "$f"
  else
    fails=$((fails + 1)); echo "$fails" > "$f"
    if [ "$fails" -eq 2 ]; then
      send_mail "[Cauce] CAIDA: $url" "Código $code en $fails chequeos seguidos ($(date -u +%FT%TZ))."
    fi
  fi
done
