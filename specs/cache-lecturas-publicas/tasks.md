# cache-lecturas-publicas — Tareas

- [x] **K1 · Servicio de caché** `public_cache.py`: `get_or_build`, candado `SET NX`, copia obsoleta, fallback sin Redis. _R1, R2_
- [x] **K2 · Endpoints** (`by-slug` y `/{id}` comparten la copia `campaign:<id>`; índice slug→id para los 404): `by-slug`, `/{id}` y `signatures/recent` usan la caché; `Cache-Control` y `no-store` en errores. _R1, R3, R4_
- [x] **K3 · Invalidación** al editar/cambiar estado de campaña. _R7_ · dependencia `_invalidate_public_cache` en el router de campañas (toda escritura con `campaign_id`, salvo `/comms/`) y creación.
- [x] **K4 · 503 con `Retry-After`** ante `TimeoutError` del pool. _R5_
- [x] **K5 · Web:** revisado, **sin cambio de código** (decisión en `design.md`, D4 corregida): la landing no usa `api-server.ts` (es de administración, con cookies)
      sino `lib/campaign-api.ts`, y `export const dynamic = "force-dynamic"` (necesario para que un slug inexistente dé 404) anula cualquier `revalidate` de `fetch`.
      El SSR sigue pidiendo a la API, que ya responde desde Redis sin consultar la base. Nuevo riesgo RK13. _R4, R6_
- [x] **K6 · Tests** (`test_public_cache.py`): hit/miss, estampida (un solo reconstructor), firma `secreta`/`anonima` ausente (**RK3**), Redis caído,
      503 con `Retry-After`, invalidación; y los de riesgo: campaña pausada rechaza firmas con landing en caché (**RK2**), 404/503/5xx con `no-store`
      (**RK5**), constructor lento de 6 s y con excepción (**RK7**), dos `Origin` distintos (**RK11**), TTL en todas las claves (**RK12**). _R1–R7, R9_
- [x] **K7 · Prueba de carga:** `read` con 0 errores 5xx y p95 < 800 ms; `nominal`, `spike`, `race` siguen pasando. _R8_
      Escenarios k6 nuevos en `loadtest/signatures.js` (entorno `lt-*`): `read_cold` (**RK9**, Redis vacío), `read_random_slugs` (**RK10**, 100 VUs con slugs
      inventados + 100 leyendo la real), `read` con `lt-redis` detenido y luego reiniciado (**RK6**), `race` tras pausar la campaña (**RK2**).
      Anotar `DBSIZE`/memoria de Redis después (**RK12**). _R8, R9_
      Resultado: `read` 0 errores, p95 719 ms, ≈ 2 100 req/s; `race` crea 1 firma; `nominal` (corto) y `spike` sin errores de servidor. En `spike` hubo altas aceptadas
      (201) que tardaron hasta 10,5 s esperando una conexión del pool: ya ocurría antes de la caché (esa ruta no la usa) y el escenario es exploratorio.
- [ ] **K8 · Cloudflare (manual):** *Cache Rule* solo `GET /v1/public-campaign/*`; verificar `cf-cache-status: HIT`. _R4_
      Verificar además: lista de rutas que **no** dan HIT, incluida una pública con `Authorization` (**RK4**); un 404 sin HIT (**RK5**);
      medir con sondeo cada 2 s cuánto tarda en verse un cambio de título/estado desde el panel y el contador tras una firma (**RK1, RK8**). _R4, R6, R9_
      **Avance (9 nov):** nginx desplegado en el VPS y dos Cache Rules activas (API `/api/v1/public-campaign/` y landing `/c/` sin query; Edge TTL
      «usar cache-control si está, omitir si no»; ruta real bajo `/api/`, no `/v1/`). Medido con `loadtest/edge_check.sh`: **landing** MISS → HIT
      (age 1 y 3 s), con query, 404, rutas de admin y `/api/health` nunca HIT; **API pública** `BYPASS` (el origen en producción aún no lleva la caché,
      sin `Cache-Control`, y la regla no la guarda: confirma que el TTL por defecto no se aplica). **Falta, tras desplegar la API con la caché:** repetir
      `headers` y `variants`, la petición con `Authorization`, y `fresh` (RK1, RK4, RK5, RK8, RK11).
- [x] **K10 · Landing cacheable en el borde (RK13):** `infra/nginx/cauce.ecuadornotlc.org.conf` pone `Cache-Control: public, s-maxage=10,
      stale-while-revalidate=5` solo a `/c/<slug>` con 200 y sin query; 404, 5xx y cualquier query (`?confirmada`, `?nombre`, `?completar=<token>`)
      van con `private, no-store`. Next no sirve (la página `force-dynamic` sobrescribe el `Cache-Control`, comprobado en la imagen de producción).
      Probado con un nginx local delante de `petition-web`. **Falta:** desplegar el archivo en el VPS (`nginx -t` y recarga) y la Cache Rule de `/c/*`
      en Cloudflare (K8). Con el borde activo se espera ≈ 1 render cada 10 s por ubicación de Cloudflare. _R4, R9_
- [x] **A3 · Altas bajo pico (hallazgo de la medición):** `spike` (100 altas/s) dentro de la red de Docker: la base no es el límite (conexiones
      «idle in transaction» esperando a la aplicación); lo es la CPU de los 2 workers, ≈ 100 altas/s sostenidas. Una corrida con la cola de correos
      atrasada dio 1 961 errores 503 (pool agotado) y p95 18 s; la repetición, con la corrección de abajo, 15 046 altas, p95 1,38 s y 1 error de servidor
      sin causa en los logs. Corregido: `attempt_send` (tarea en segundo plano) dejaba subir `QueuePool timeout` con la respuesta ya enviada
      (`RuntimeError: response already started`, 22 veces); ahora deja la firma `pending` para el loop y registra un aviso
      (`tests/test_attempt_send_pool.py`). El envío de correos es de ≈ 4/s (2 procesos × 2/s): tras `spike` quedaron 28 256 `pending`, se drenan solos.
      Referencia real: 1 alta/s nominal y 10/s de ráfaga, 10 veces por debajo del límite.
- [ ] **K9 · Resultado de riesgos:** completar la tabla de abajo con evidencia y clasificar cada RK como asumido o crítico; los críticos se corrigen
      antes de desplegar. _R9_

## Resultado de riesgos (8 nov 2026, entorno `lt-*`, k6 dentro de la red de Docker para evitar el proxy de puertos del Mac)
Antes de la caché, `read` (300 lectores): ≈ 92 req/s, 21 % de 5xx, p95 11 s. Después: ≈ 2 100 req/s, 0 errores, p95 719 ms (23× más).

| ID | Medición | Clasificación | Evidencia / decisión |
|---|---|---|---|
| RK1 | _pendiente de K8 (Cloudflare real)_ | pendiente | Se mide con el borde activo; hoy solo existe la capa Redis (10 s) |
| RK2 | Test: cerrar la campaña refresca la copia (MISS con `status=closed`) y la firma recibe 409 | **asumido** (cumple) | El alta valida contra la base, nunca contra la copia. Falta repetir `race` tras pausar con el borde activo |
| RK3 | Test: nombres `anonima`/`secreta` ausentes en respuesta y en la copia de Redis (ficha y recientes) | **no ocurre** (cumple) | Cubierto por `test_public_cache.py`; no se asume nunca |
| RK4 | _pendiente de K8_ | pendiente | Lista de rutas sin HIT en Cloudflare antes de activar la regla |
| RK5 | Tests: 404 y 503 con `Cache-Control: no-store`; k6 `read_random_slugs`: 404 con `no-store` | **no ocurre** (cumple) en el origen | Falta confirmar `cf-cache-status` ≠ HIT en K8 |
| RK6 | k6 con Redis detenido (60 s, 300 lectores): 0 errores 500, 75 437 respuestas 503 con `Retry-After`, p95 1,2 s; repetido 3 veces (8 nov): 0 errores 500, 23–25 % de 503 con `Retry-After`, p95 0,59–0,63 s en las tres; tras `docker start` vuelven los 200 | **asumido** | Hallazgo corregido: la primera versión tardaba 10 s por 503 (esperaba el pool). Ahora hay tope de 8 lecturas simultáneas por proceso a la base (el exceso recibe 503 en ≤ 0,5 s) e interruptor de 5 s tras un fallo de Redis |
| RK7 | Tests: constructor de 1,5 s con candado de 1 s → ≤ 2 reconstrucciones y 20 peticiones en < 3,5 s; constructor con excepción libera el candado | **asumido** (cumple) | — |
| RK8 | _pendiente de K8_ | pendiente | Misma medición que RK1 |
| RK9 | k6 `read_cold` con Redis vacío, 3 repeticiones: 0 errores; p95 375–778 ms. La primera versión dio 2 344 respuestas 503 (3 %) | **era crítico, corregido** → asumido | Causa: 300 esperando con sondeo cada 50 ms y espera de 2 s agotaban el tiempo mientras se reconstruían índice y ficha. Ahora sondeo con variación (0,1–0,25 s) y espera de 4 s |
| RK10 | k6 `read_random_slugs` (100 lectores + 100 con slugs/ids inventados, 2 min): 0 errores, todos los inventados dan 404, p95 de los lectores 428 ms | **asumido** (cumple) | Se resolvió con un índice de campañas visibles en Redis (D7) en vez de la caché negativa por slug propuesta: esta no frena slugs distintos en cada petición |
| RK11 | Test: `Vary: Origin` presente; un origen no permitido no recibe `Access-Control-Allow-Origin` | **asumido** (cumple) | Verificar también con Cloudflare en K8 |
| RK12 | `DBSIZE` = 3 tras 247 000 peticiones con slugs inventados; memoria de Redis ≈ 10 MB; test: todas las claves con TTL ≤ 40 s | **asumido** (cumple) | El índice evita una clave por slug inventado |
| RK13 | k6 `ssr` (`/c/<slug>`, imagen de producción de `petition-web`, 1,5 CPU y 1 GB como en el compose), 90 s por escalón: 50 lectores → 49 req/s, p95 2,35 s; 100 → 65 req/s, p95 2,58 s; 150 → 47 req/s, p95 8,2 s y respuestas que no son 200. La CPU de la web está al 130–140 % en todos. Con 1 CPU y 512 MB el proceso murió por memoria (heap de Node) a los 150 lectores | **crítico → mitigado en origen (K10); falta verificar en el borde (K8)** | La API no es el límite (CPU 2–8 %); la capacidad la fija el render de Next, ≈ 50–65 páginas/s. Cloudflare no cachea este HTML. Opciones: cachear `/c/<slug>` en el borde con TTL de 10 s, reducir el coste del render o aceptar el riesgo con el pico esperado |
