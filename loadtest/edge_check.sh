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
  echo "-- 3a. Landing con parámetros de seguimiento (fbclid/utm): comparte la copia (cf=HIT a partir de la 2.ª; cc=public)"
  for i in 1 2 3; do hdr "$BASE/c/$SLUG?fbclid=IwAR$RANDOM&utm_source=prueba"; sleep 1; done
  echo "-- 3b. Landing con query personal (?confirmada, ?nombre, ?completar, o con %): NUNCA HIT (cf=DYNAMIC, cc=private, no-store)"
  for i in 1 2; do hdr "$BASE/c/$SLUG?confirmada=1&nombre=Prueba"; sleep 1; done
  hdr "$BASE/c/$SLUG?completar=token-inventado"
  hdr "$BASE/c/$SLUG?%63onfirmada=1&%6eombre=Prueba"
  echo "-- 3c. El HTML con query personal NO debe ser el de la copia compartida (popup presente solo con confirmada)"
  A=$(curl -s "$BASE/c/$SLUG" | grep -c 'Firma confirmada\|Gracias, Prueba')
  B=$(curl -s "$BASE/c/$SLUG?confirmada=1&nombre=Prueba" | grep -c 'Firma confirmada\|Gracias, Prueba')
  echo "   sin query: $A coincidencias (esperado 0) · con ?confirmada=1: $B (esperado > 0 con el popup; 0 también es válido si el popup se pinta en el navegador)"
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
  echo "== Landing: 20 variantes ?fbclid=N (esperado: HIT tras la primera; comparten copia) =="
  for i in $(seq 1 20); do hdr "$BASE/c/$SLUG?fbclid=$i"; done | awk '{print $2}' | sort | uniq -c
  echo "== Landing: 10 variantes con parámetro desconocido ?x=N (la regla ignora la query: HIT mientras la copia limpia esté fresca; nunca se guarda una copia propia) =="
  for i in $(seq 1 10); do hdr "$BASE/c/$SLUG?x=$i"; done | awk '{print $2}' | sort | uniq -c
  ;;
fresh)
  # Mide dos capas a la vez: la URL limpia (lo que ve un visitante: Cloudflare + Redis) y una variante ?z=<aleatorio> que esquiva la copia de Cloudflare
  # y llega al origen (solo la caché de Redis). Así, si hay retraso, se ve en qué capa está.
  clean() { curl -s "$API/by-slug/$SLUG" | jq -r '[.petition_title, .status, .signature_count, .total_count] | @tsv' 2>/dev/null; }
  origin() { curl -s "$API/by-slug/$SLUG?z=$RANDOM$RANDOM" | jq -r '[.petition_title, .status, .signature_count, .total_count] | @tsv' 2>/dev/null; }
  measure() {  # measure <etiqueta> <criterio-s>
    local base_c base_o seen_c="" seen_o="" t0 e now_c now_o
    base_c="$(clean)"; base_o="$(origin)"; t0=$(date +%s)
    echo "   línea base → borde: $base_c"
    echo "   (guarda el cambio AHORA; el reloj ya corre; máximo 240 s)"
    while :; do
      sleep 2; e=$(( $(date +%s) - t0 ))
      now_o="$(origin)"; now_c="$(clean)"
      [ -z "$seen_o" ] && [ "$now_o" != "$base_o" ] && { seen_o=$e; echo "   · origen (Redis) ya lo muestra a los ${e} s"; }
      [ -z "$seen_c" ] && [ "$now_c" != "$base_c" ] && { seen_c=$e; echo "   · BORDE (visitante) ya lo muestra a los ${e} s:  $now_c"; }
      [ -n "$seen_c" ] && break
      [ "$e" -ge 240 ] && { echo "   → sin cambio en el borde tras 240 s (¡revisar!). Origen: ${seen_o:-tampoco}"; break; }
    done
    echo "   Criterio $1: ≤ $2 s desde que se GUARDA el cambio. Medido en el borde: ${seen_c:-NO}"
  }
  echo "Valor actual (título · estado · firmas · total):"; clean
  echo
  echo "1) TÍTULO/ESTADO. Ten el panel de administración listo con el cambio escrito pero SIN guardar. Pulsa Enter y guarda de inmediato."
  read -r _; measure "título/estado" 45
  echo
  echo "2) CONTADOR. Ten lista la confirmación de una firma de prueba (el botón del correo abierto) pero SIN pulsar. Pulsa Enter aquí y confirma de inmediato."
  read -r _; measure "contador" 60
  echo "Si el borde pasa de los criterios, baja stale-while-revalidate de 30 a 5 en la API (RK1, RK8)."
  ;;
*) sed -n 2,9p "$0"; exit 1 ;;
esac
