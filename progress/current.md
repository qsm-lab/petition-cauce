# Estado actual — tras sesión 42 (2026-07-28/29) — CERRADA, mergeada y desplegada

## Resumen de sesión 42

Sesión que arrancó como una verificación de rutina (¿está activa la cuota
diaria Pro de Resend en producción?) y terminó en un incidente real de
producción con recuperación completa: un envío de cierre de campaña a
1236 destinatarios reales (`soberania-tlc-ecu-usa`) quedó parcialmente
entregado —y marcado como completo dos veces sin estarlo— por una cadena
de 3 bugs reales de concurrencia en el loop de la cola de
`centro-comunicaciones`. Los 1236 correos terminaron entregándose sin
fallos. Los 3 bugs quedaron corregidos, con tests de regresión, y
documentados en `docs/engineering/runbook_colas_asincronas_email.md` para
que no se repitan en features futuras de envío masivo.

## Estado de git — CERRADO, mergeado a main y desplegado

3 commits en `dev` (`deea075`, `c8d93a7`, `e4a89fa`), cada uno con su
propio PR mergeado a `main`: **#21**, **#22**, **#23**. `origin/main` ==
`origin/dev` == `dev` local en `9c8ab19`, sin divergencia. Deploy
verificado tras cada uno de los 3 (`GET /api/health` → `{"status":"ok",
"db":"ok","redis":"ok"}`).

## Incidente: cronología y causas (detalle completo en `progress/history.md`)

**Disparador**: al activar `RESEND_PLATFORM_PLAN=pro` en producción (ver
sección siguiente), se usó `docker compose restart` y luego
`--force-recreate` sobre `petition-api` sin verificar que había un envío
real en curso — cortó un lote de ~100 destinatarios a mitad de camino.

**Bug 1** (`_finalize_if_done`): la condición de "¿terminó el envío?"
solo contaba lotes `pending`, no `sending`. Un lote huérfano en `sending`
(por el reinicio, o por cualquier otra causa) no bloqueaba el cierre —el
envío se marcaba `status=sent` completo aunque le faltaran cientos de
destinatarios. Fix: la condición ahora exige que no quede ningún lote ni
`pending` ni `sending`. PR #21 (`deea075`), junto con el TTL del lock de
Redis subido de 30s a 300s (un lote real de ~100 correos por red puede
tardar más que el intervalo de polling) y la adquisición del lock
protegida por su propio `try/except`.

**Bug 2** (GUC transaccional): `process_due_scheduled_sends` seteaba
`app.is_platform_admin` con `set_config(..., true)` — `SET LOCAL`,
transaccional. El loop corre fuera de un request, con múltiples
`commit()` dentro del mismo tick (`_claim_batch` comitea de inmediato);
apenas ocurría el primer commit, el GUC se perdía y las consultas
siguientes del mismo tick corrían sin RLS habilitado como
`platform_admin`, devolviendo `None` donde se esperaba una fila real. El
propio docstring de la función decía imitar el patrón de
`retention_service.py`, que sí usa `is_local=false` — el bug era la
inconsistencia entre ambos. Fix de una palabra (`true`→`false`) + un
guard defensivo. PR #22 (`c8d93a7`).

**Bug 3** (autoreparación + StaleDataError): el guard del bug 2 solo
logueaba y saltaba el lote sin liberarlo — quedaba igual huérfano para
siempre. Y `_finalize_if_done` cerraba el envío con una asignación ORM +
`commit()`, que bajo dos ticks concurrentes cerrando el mismo envío
disparaba `StaleDataError` sin capturar. Fix: el guard ahora libera el
lote a `pending` con un UPDATE directo; el cierre pasó a un UPDATE
atómico estilo Core condicionado a `status=="sending"` (mismo patrón que
el claim), que de paso evita duplicar la fila de historial si dos ticks
cierran a la vez. PR #23 (`e4a89fa`).

**Verificación final**: suma de `sent_count` por lote (no el campo
cacheado del envío padre, que quedó desincronizado por una carrera previa
a los 3 fixes) = 1236/1236, `failed_count=0` en los 15 lotes.

## Documentación nueva

- `docs/engineering/runbook_colas_asincronas_email.md` (versionado,
  nuevo): los 5 errores de diseño generalizados + checklist de 8 puntos
  para la próxima feature de envío masivo, en este proyecto o en otro.
  Referenciado desde `PROJECT_REFERENCE.md` §10.
- Memoria de usuario (`~/.claude/.../memory/`): `docker compose restart`
  no relee `.env` en este VPS — hace falta `--force-recreate`.

## Pendiente para la próxima sesión

- **Cosmético, sin urgencia**: `scheduled_send.sent_count` del envío de
  cierre de `soberania-tlc-ecu-usa` quedó en `1139` en vez de `1236`
  (carrera anterior a los 3 fixes, antes de que existiera protección
  alguna). No afecta la entrega real (confirmada por suma de lotes),
  solo el número mostrado en el historial de ese envío puntual. Se puede
  corregir con un `UPDATE` puntual de esa fila si se quiere prolijidad
  en el historial.
- Confirmar `alembic current` en producción (pendiente desde sesión 41,
  no se tocó en esta — sin migraciones nuevas en los 3 fixes de hoy, así
  que sigue siendo `041` esperado).
- Decidir Fase 4 de `centro-comunicaciones` (remitente por dominio propio
  Pro) — sigue sin tocar.
- Considerar si vale la pena implementar el punto opcional del checklist
  del runbook nuevo (persistencia incremental dentro de un lote grande,
  para que un crash a mitad de lote pierda como máximo unos pocos envíos
  sin registrar en vez del lote entero) — no crítico, el sistema ya se
  autorepara con los fixes de hoy.

## Datos dev

| Campo | Valor |
|-------|-------|
| Email admin | `admin@cauce.ec` / `admin123dev` |
| URL admin | `http://localhost:3002/admin/resumen` |
| API | `http://localhost:8011` |
| Docker | Se cayó dos veces durante la sesión (Docker Desktop local del Mac, no el VPS) — se relevantó manualmente ambas veces. |
| Alembic dev | `041 (head)` — sin cambios en esta sesión (los 3 fixes son solo código Python). |
| Suite de tests | 232 passed (231 al cierre de sesión 41 → +1 test de regresión del bug 1). |

## Datos producción

**Desplegado y verificado.** 3 PRs (#21, #22, #23) mergeados a `main`,
deploy corrido tras cada uno. `RESEND_PLATFORM_PLAN=pro` confirmado
activo (`daily_quota: null, monthly_quota: 50000` vía
`GET /comms/quota`). El incidente completo (disparado durante esta misma
verificación) quedó resuelto: 1236/1236 correos del envío de cierre de
`soberania-tlc-ecu-usa` entregados, 0 fallos.

## Al inicio de la próxima sesión

```bash
docker compose -f docker-compose.dev.yml up -d   # por si el daemon local se cayó
git checkout dev && git status
git fetch origin
git log --oneline origin/dev..dev                  # debería estar vacío
docker exec petition-api-dev alembic current       # 041 esperado en dev
```
