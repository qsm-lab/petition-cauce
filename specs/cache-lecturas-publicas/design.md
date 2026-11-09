# cache-lecturas-publicas — Diseño

## Decisiones
| # | Decisión | Motivo |
|---|---|---|
| D1 | Caché en **Redis** por campaña (`pubcache:v1:<tipo>:<id|slug>`, TTL 10 s), no en memoria de proceso | Hay 2 workers: una copia común evita duplicar consultas y mantiene la misma versión para todos |
| D2 | **Un solo reconstructor** con `SET NX EX 5` como candado; el resto sirve la copia anterior (se guarda con TTL 40 s y `fresh_until` dentro del valor) | Evita la estampida al vencer la copia (R2) |
| D3 | Cabeceras `Cache-Control: public, s-maxage=10, stale-while-revalidate=30` + regla de caché en Cloudflare para `/v1/public-campaign/*` GET | Cloudflare no cachea JSON por defecto; hace falta una *Cache Rule* explícita |
| D4 | ~~Next `revalidate: 10` en `api-server.ts`~~ **Corregida al implementar:** `api-server.ts` es de administración y la landing es `force-dynamic` (requisito del 404), que anula `revalidate`. No hay caché en Next; la caché real está en la API (Redis) y en Cloudflare para la API | `force-dynamic` + `fetch` con `revalidate` no se combinan; quitar `force-dynamic` devolvería 200 en slugs inexistentes |
| D7 | **Índice de campañas visibles** (`index`: slug→id e ids) en la misma caché; los slugs/ids que no están responden 404 sin tocar la base. Sustituye a la «caché negativa por slug» propuesta en RK10 | Una caché negativa por slug no frena slugs *distintos* en cada petición; el índice sí, y no crea una clave por slug inventado (RK12) |
| D8 | `by-slug` y `/{id}` comparten la clave `campaign:<id>`; la invalidación borra esa clave y el índice | Una sola reconstrucción por campaña; el slug nuevo se ve de inmediato |
| D5 | Manejador de `sqlalchemy.exc.TimeoutError` → `503` + `Retry-After: 5` | Degradar sin trazas de 10 s (R5) |
| D6 | Invalidación explícita al guardar/cambiar estado de campaña (`DEL pubcache:*:<id>`) | R7 |

## Archivos afectados
- `apps/api/app/services/public_cache.py` (nuevo): `get_or_build(key, builder, ttl)` con candado y copia obsoleta.
- `apps/api/app/routers/public_campaign.py`: los 3 endpoints usan la caché y devuelven `Cache-Control`.
- `apps/api/app/main.py`: manejador de `TimeoutError` del pool → 503.
- Rutas de edición de campaña (`routers/campaigns*.py`): llamada a la invalidación.
- `apps/web/src/lib/api-server.ts` y la landing: `revalidate` en lugar de `no-store`.
- `apps/api/tests/test_public_cache.py` (nuevo); `loadtest/` sin cambios (el escenario `read` ya existe).
- Cloudflare (manual, runbook): *Cache Rule* para `GET /v1/public-campaign/*` (respetar el `Cache-Control` del origen).

## Seguridad y LOPDP
- La clave incluye el id de campaña; no hay datos por usuario. Se cachea el mismo objeto que hoy es público.
- `signatures/recent` ya filtra por visibilidad: la copia se construye con esa misma función (R3). Test: una firma `secreta` no aparece.
- Las respuestas de error (404/503) **no** se cachean en el borde (`Cache-Control: no-store`).
- Sin PII en logs; el log de saturación cuenta eventos, no firmantes.

## Registro de riesgos y cómo se evalúan (R9)
**Clasificación.** Cada riesgo se mide con la prueba indicada y queda **asumido** (se cumple el criterio «asumido»: se documenta y se
sigue) o **crítico** (se cumple el criterio «crítico»: bloquea el despliegue hasta corregirlo). Entre ambos criterios, se corrige si
es barato o se asume por escrito con fecha de revisión. El resultado se anota en la tabla «Resultado» de `tasks.md`.

| ID | Riesgo | Prueba (instancia) | Asumido si | Crítico si |
|---|---|---|---|---|
| RK1 | **Frescura apilada.** Las capas suman: Redis 10 s + Cloudflare (`s-maxage` 10 + `stale-while-revalidate` 30) + Next `revalidate` 10. El peor caso supera los 15 s de R6 | Medición en K8: editar el título, sondear la landing cada 2 s y anotar cuánto tarda en verse; lo mismo con el contador tras una firma | Título/estado se ve en ≤ 45 s y el contador en ≤ 60 s | Título/estado tarda > 60 s, o la pantalla de «gracias» depende del contador |
| RK2 | **Campaña cerrada o pausada sigue mostrando el formulario** y la gente firma | `test_public_cache.py`: con la landing en caché, pausar la campaña y firmar; k6 `race` tras pausar | La firma se rechaza en el servidor y solo la vista tarda en cambiar (≤ RK1) | Alguna firma entra en una campaña cerrada |
| RK3 | **Fuga de visibilidad:** la copia expone nombres `anonima`/`secreta` | `test_public_cache.py`: firmas de las tres visibilidades; comparar la copia en Redis y la respuesta con el filtro actual | — (no se asume) | Cualquier nombre no público aparece en la respuesta, la copia o el borde |
| RK4 | **Cache Rule demasiado ancha** cachea administración, `confirm`, `mis-datos` o peticiones con `Authorization` | K8: `curl -I` a una lista de rutas (admin, `/auth`, `/confirm`, POST de firma, `mis-datos`) y a una pública con `Authorization`; ninguna debe dar `cf-cache-status: HIT` | Solo `GET /v1/public-campaign/*` hace HIT | Cualquier otra ruta o petición autenticada da HIT |
| RK5 | **Errores cacheados en el borde** (404/503 con `s-maxage`) | Test de cabeceras: 404, 503 y 5xx llevan `no-store`; K8 confirma `cf-cache-status` ≠ HIT en un 404 | — | Un 404/5xx se sirve desde caché |
| RK6 | **Redis caído:** la lectura vuelve a la base y el pool se satura otra vez | k6 `read` con `petition-redis` detenido (entorno `lt-*`) y luego reiniciado | Hay 503 limpios con `Retry-After`, sin 500 y p95 de error < 2 s; el servicio vuelve solo al reiniciar Redis | Aparecen 500, trazas por petición o no se recupera tras volver Redis |
| RK7 | **Candado atascado o reconstructor lento** (> 5 s): reconstrucciones duplicadas o peticiones colgadas | `test_public_cache.py`: constructor que tarda 6 s y otro que lanza excepción; 50 peticiones concurrentes | A lo sumo 2 reconstrucciones y nadie espera > 2 s | Hay peticiones colgadas > 10 s o el candado queda tomado tras una excepción |
| RK8 | **Invalidación incompleta:** R7 borra Redis, pero el borde y Next conservan la copia | Misma medición de RK1, editando desde el panel | El cambio se ve dentro del límite de RK1 | Un cambio de estado (pausa/cierre) no se ve tras 60 s |
| RK9 | **Arranque en frío:** tras desplegar o `FLUSHALL`, 300 lectores llegan con la caché vacía | k6 nuevo `read_cold`: vaciar Redis y lanzar `read` de inmediato | Máximo 1 reconstrucción por campaña y 0 errores 5xx | Hay 5xx o más de 3 reconstrucciones simultáneas por campaña |
| RK10 | **Slugs aleatorios** (404) evaden la caché y agotan el pool | k6 nuevo `read_random_slugs`: 100 VUs con slugs inventados mientras 100 VUs leen la campaña real | La campaña real mantiene 0 errores 5xx y p95 < 800 ms (404 con caché negativa corta de 30–60 s en Redis) | La campaña real sufre 5xx o p95 > 2 s |
| RK11 | **Cabeceras CORS cacheadas:** `Access-Control-Allow-Origin` de un origen servido a otro | Test de cabeceras con dos `Origin` distintos; la respuesta lleva `Vary: Origin` o no depende del origen | `Vary: Origin` presente o CORS fijo | La respuesta de un origen se entrega a otro sin `Vary` |
| RK13 | **El SSR de la landing sigue siendo por visita:** la caché protege la API y la base, pero Next renderiza cada visita (HTML `private`, sin caché en el borde) | Medir con la landing real (`/c/<slug>`) en el entorno de carga o en una prueba corta de producción: CPU/memoria de `petition-web` con 100–300 visitas/s | `petition-web` sostiene la carga prevista (≈ pico 100/s) con p95 < 1,5 s | `petition-web` satura CPU/memoria o devuelve 5xx; entonces habría que cachear el HTML en Cloudflare |
| RK12 | **Memoria de Redis** por claves de caché | Tras `read_random_slugs`: `DBSIZE` y `INFO memory` (solo números); TTL en todas las claves `pubcache:*` | Todas las claves tienen TTL y la memoria crece < 50 MB | Hay claves sin TTL o la memoria crece sin tope |

**Decisión abierta (RK1/R6):** con `stale-while-revalidate=30` el peor caso real supera los 15 s de R6. Recomendación: medir en K8 y, si RK1
queda crítico, bajar a `stale-while-revalidate=5`. Mientras tanto R6 se lee «≤ 45 s para título/estado y ≤ 60 s para el contador».

## Otros riesgos (ya contemplados)
- Contador atrasado hasta 10 s tras firmar: la pantalla de «gracias» no depende de él.
- Si Redis cae: la lectura vuelve a la base (sin caché) y se registra; no se rompe el servicio (ver RK6).
