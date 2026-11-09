#!/usr/bin/env bash
# cache-lecturas-publicas K8 — comprobaciones del borde (Cloudflare) sobre el dominio real. Solo lecturas GET; no envía credenciales ni firmas.
#
#   bash loadtest/edge_check.sh headers  <dominio> <slug>    # B1/B3/B4: qué se cachea y qué no
#   bash loadtest/edge_check.sh variants <dominio> <slug>    # B6: variantes de URL (?x=N) no deben esquivar ni llenar la caché
#   bash loadtest/edge_check.sh fresh    <dominio> <slug>    # B5: cuánto tarda en verse un cambio de título/estado/contador
#
# <dominio> sin https:// (p. ej. cauce.ecuadornotlc.org). Requiere curl y jq.
set -u
MODE="${1:-}"; HOST="${2:-}"; SLUG="${3:-}"
[ -z "$MODE" ] || [ -z "$HOST" ] || [ -z "$SLUG" ] && { sed -n 2,9p "$0"; exit 1; }
BASE="${EDGE_BASE:-https://$HOST}"   # EDGE_BASE y API_PREFIX solo para ensayar contra el entorno local
API="$BASE${API_PREFIX-/api}/v1/public-campaign"

hdr() {  # hdr <url> [curl args…] → estado y cabeceras relevantes en una línea
  local url="$1"; shift
  curl -s -o /dev/null -D - "$@" "$url" | tr -d '\r' | awk -F': ' '
    NR==1 {split($0, a, " "); st=a[2]}
    tolower($1)=="cf-cache-status" {cf=$2}
    tolower($1)=="x-cache" {xc=$2}
    tolower($1)=="age" {age=$2}
    tolower($1)=="cache-control" {cc=$2}
    END {printf "%-4s cf=%-8s x-cache=%-6s age=%-3s cc=%s\n", st, cf, xc, age, cc}'
}

case "$MODE" in
headers)
  echo "== Contrato: Cloudflare solo debe dar HIT donde se espera =="
  echo "-- 1. API pública de la campaña: 3 peticiones seguidas (la 2.ª o 3.ª debe ser cf=HIT)"
  for i in 1 2 3; do hdr "$API/by-slug/$SLUG"; sleep 1; done
  echo "-- 2. Landing /c/<slug>: 3 peticiones (cf=HIT esperado a partir de la 2.ª; cc=public, s-maxage=10)"
  for i in 1 2 3; do hdr "$BASE/c/$SLUG"; sleep 1; done
  echo "-- 3. Landing con query: NUNCA HIT (cc=private, no-store)"
  for i in 1 2; do hdr "$BASE/c/$SLUG?confirmada=1&nombre=Prueba"; sleep 1; done
  echo "-- 4. Slug inexistente (404): NUNCA HIT, dos veces cada uno"
  for i in 1 2; do hdr "$API/by-slug/no-existe-$(date +%s)-xyz"; done
  for i in 1 2; do hdr "$BASE/c/no-existe-xyz"; done
  echo "-- 5. Petición con Authorization (token falso): NUNCA HIT"
  for i in 1 2; do hdr "$API/by-slug/$SLUG" -H 'Authorization: Bearer x'; done
  echo "-- 6. Otras rutas de la API: NUNCA HIT (deben salir cf=DYNAMIC o vacío)"
  for p in /api/v1/campaigns /api/v1/auth/me /api/health; do echo -n "$p  "; hdr "$BASE$p"; hdr "$BASE$p"; done
  ;;
variants)
  echo "== 40 variantes ?x=N de la ficha: si la regla ignora el query, todas salen HIT tras la primera =="
  for i in $(seq 1 40); do hdr "$API/by-slug/$SLUG?x=$i"; done | awk '{print $2, $3}' | sort | uniq -c
  echo "(MISS repetido = cada variante va al origen: activar «ignorar query string» en la clave de caché)"
  echo "== Lo mismo con la landing =="
  for i in $(seq 1 20); do hdr "$BASE/c/$SLUG?x=$i"; done | awk '{print $2, $3}' | sort | uniq -c
  echo "(aquí DYNAMIC es lo correcto: una landing con query lleva no-store)"
  ;;
fresh)
  # URL limpia: es lo que ve un visitante normal (sin parámetros que esquiven la caché).
  clean() { curl -s "$API/by-slug/$SLUG" | jq -r '[.petition_title, .status, .signature_count, .total_count] | @tsv' 2>/dev/null; }
  echo "Valor actual (título · estado · firmas · total):"; clean
  echo
  echo "1) Cambia el TÍTULO (o el estado) en el panel de administración y pulsa Enter EN ESE MOMENTO."
  read -r _
  T0=$(date +%s); BASE_VAL="$(clean)"
  echo "Sondeo cada 2 s sobre la URL limpia; termina solo al ver un cambio o a los 180 s…"
  while :; do
    sleep 2; NOW="$(clean)"; E=$(( $(date +%s) - T0 ))
    if [ "$NOW" != "$BASE_VAL" ]; then echo "→ cambio visible a los ${E} s:  $NOW"; break; fi
    [ "$E" -ge 180 ] && { echo "→ sin cambio tras 180 s (¡revisar!)"; break; }
  done
  echo "Criterio: ≤ 45 s para título/estado. Si pasa de eso, baja stale-while-revalidate de 30 a 5 (RK1, RK8)."
  echo
  echo "2) CONTADOR: confirma una firma de prueba (o pide que se confirme) y pulsa Enter EN ESE MOMENTO."
  read -r _
  T0=$(date +%s); BASE_VAL="$(clean)"
  while :; do
    sleep 2; NOW="$(clean)"; E=$(( $(date +%s) - T0 ))
    if [ "$NOW" != "$BASE_VAL" ]; then echo "→ contador visible a los ${E} s:  $NOW"; break; fi
    [ "$E" -ge 180 ] && { echo "→ sin cambio tras 180 s (¡revisar!)"; break; }
  done
  echo "Criterio: ≤ 60 s."
  ;;
*) sed -n 2,9p "$0"; exit 1 ;;
esac
