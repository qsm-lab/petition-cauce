# cache-lecturas-publicas — Requisitos (EARS)

Origen: `hardening-campana` T4.2. El escenario k6 `read` (300 lectores concurrentes, 3 min) contra el entorno aislado dio
**16 560 peticiones (≈ 92/s), 21 % con 5xx y p95 de 11 s**. Todos los 500 son `QueuePool limit of size 10 overflow 10 reached,
connection timed out` en tres endpoints que la landing llama en cada visita: `GET /by-slug/{slug}`, `GET /{campaign_id}` y
`GET /{campaign_id}/signatures/recent`. No tienen ninguna caché y la web los pide con `cache: "no-store"`. `by-slug` hace 4 consultas
por visita (campaña, organización, conteo de firmas y conteo total). La escritura no es el problema (`spike`: 100 altas/s, 0 errores).

## Requisitos
- **R1 — Caché corta.** Cuando se piden los tres endpoints públicos de lectura, el sistema SHALL servir una copia con vigencia de
  10 s como máximo, calculada una vez por campaña y compartida entre los workers (Redis), en lugar de consultar la base en cada visita.
- **R2 — Sin estampida.** Cuando una copia vence y llegan muchas peticiones a la vez, el sistema SHALL recalcular una sola vez
  (un solo proceso reconstruye; los demás sirven la copia anterior hasta 30 s o esperan el resultado).
- **R3 — Sin datos personales nuevos.** La copia SHALL contener solo lo que hoy devuelve el endpoint (visibilidad ya filtrada) y
  SHALL NOT incluir nombres de firmas `anonima` o `secreta` que hoy no se muestran.
- **R4 — Caché de borde.** Las respuestas SHALL llevar `Cache-Control: public, s-maxage=10, stale-while-revalidate=30` y la web SHALL
  usar `revalidate: 10` en lugar de `no-store`, para que Cloudflare y Next absorban la mayoría de las visitas.
- **R5 — Degradación elegante.** Cuando el pool de conexiones se agote, el sistema SHALL responder `503` con `Retry-After: 5` (no `500`) en
  menos de 2 s, y SHALL registrar la saturación sin trazas por petición.
- **R6 — Frescura aceptable.** Un cambio de estado o título de la campaña SHALL verse en la landing en ≤ 15 s; el contador de firmas puede
  retrasarse hasta 10 s. Tras firmar, la persona SHALL ver su confirmación sin depender del contador.
- **R7 — Invalidación.** Cuando el administrador edita o cambia el estado de una campaña, el sistema SHALL borrar su copia para que el cambio
  se vea de inmediato.
- **R8 — Prueba.** El escenario `read` SHALL pasar con 0 errores 5xx y p95 < 800 ms; `nominal`, `spike` y `race` SHALL seguir pasando.
- **R9 — Riesgos evaluados.** Cada riesgo del registro de `design.md` (RK1–RK12) SHALL tener al menos una prueba con criterio explícito
  y quedar clasificado como **asumido** o **crítico** con la evidencia de la prueba. Un riesgo **crítico** bloquea el despliegue.

## Fuera de alcance
Caché de endpoints autenticados o de administración; caché de escrituras; CDN para estáticos (ya lo hace Cloudflare).
