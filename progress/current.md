# Estado actual — tras sesión 44 (2026-10-23/24) — CERRADA (commiteada; envío masivo en curso)

## Resumen de sesión 44

Sesión para tener un segundo canal de email ante el límite de Resend Free y
la espera de AWS. Dos features implementadas con spec aprobada, **sin
commitear** (el usuario commitea):

- **`ses-transport`** (T1–T6): abstracción `EmailTransport` con adaptadores
  Resend / SES (aioboto3, SESv2) / Brevo; switch global `EMAIL_PROVIDER`.
  La cuenta SES sigue en sandbox (solo envía a direcciones verificadas);
  se pidió acceso a producción a AWS (volumen 2.000–5.000/mes), sin respuesta.
- **`brevo-pool`** (T1–T7): `BrevoTransport` (API v3, httpx) y pool
  `EMAIL_POOL=brevo,resend` que reparte cada lote de la cola de
  `centro-comunicaciones` según el cupo diario restante de cada proveedor
  (contador Redis por proveedor). Lo que sobra pasa a un lote `pending`
  nuevo. Capacidad: Brevo 300 (confirmado por el usuario) + Resend 150
  (`RESEND_DAILY_QUOTA`) = 450/día, unos 5 días para ~2.200 correos.
- **Fixture autouse `_no_real_email`** en `tests/conftest.py`: las corridas
  de la suite enviaban correo real (36 por pasada) con la clave de Resend
  del contenedor dev y agotaron el plan Free (106/100).

Tests: 262 passed (258 + 4 del RAT/contrato), 0 llamadas reales a Resend/Brevo.

## Estado del despliegue en el VPS (2026-10-24)

Desplegado en el VPS: antes de recrear no había envíos ni lotes en curso;
`petition-api` recreado con `EMAIL_POOL=brevo,resend`, `BREVO_DAILY_QUOTA=300`,
`RESEND_DAILY_QUOTA=150`. Arranque sin errores, `/health` 200, `alembic current`
= `041 (head)`. `EMAIL_PROVIDER` sin definir (= `resend`).

**T8 cumplida**: dos correos de prueba por Brevo llegaron a Gmail con SPF, DKIM
(`ecuadornotlc.org`, selector `brevo2`) y DMARC en `pass`; return-path
`camp.ecuadornotlc.org`.

**Hallazgo abierto — pixel de seguimiento**: el relay de Brevo inyecta un pixel
de aperturas (`r.camp.ecuadornotlc.org/tr/op/...`) y una cabecera
`List-Unsubscribe` propia (baja en un clic hacia Brevo). Una segunda prueba
tras cambiar un ajuste en Brevo **siguió mostrando el pixel**: el ajuste no
aplica al correo transaccional, o el plan no lo permite. Sin resolver.

## Envío real siempre por la cola (2026-10-24)

`POST /comms/send` ya no envía en el request cuando es un envío real: lo encola como
envío programado para ahora (`schedule_send`) y devuelve `queued: true`. El loop lo
reparte por lotes según el cupo diario de cada proveedor (pool o único) y el excedente
pasa a lotes `pending` de los días siguientes hasta completar la lista. Antes, "Enviar
ahora" recorría toda la lista en un solo request y por `EMAIL_PROVIDER` (ignoraba el
pool y la cuota). Las pruebas (`test_emails`) siguen siendo inmediatas. La UI quitó la
alerta de "fase futura" y confirma que va en lotes diarios; el envío real promueve el
borrador (`draft_id`). Tests: `tests/test_comms_send_queue.py`.

## Regla del botón "Enviar ahora" (2026-10-24)

Con tope diario (planes free: Brevo, Resend o la suma del pool) y una lista mayor al
cupo restante de hoy, **"Enviar ahora" queda desactivado** (con la advertencia que
sugiere "Programar envío"). `sendReal` también lo bloquea por si se invoca igual. Si
algún proveedor está en Pro (`daily_quota: null`) o la lista cabe hoy, sigue activo.
El modal de **Programar** calcula la entrega con `lib/comms-delivery.ts`
(`estimateDelivery`): si hay tope y no cabe, avisa que sale por lotes (cuota diaria,
cuánto sale a la hora programada, ciclos y fecha estimada de término; la cuota se
renueva a las 19:00 de Guayaquil); si cabe o no hay tope, avisa que la entrega será
completa en la fecha y hora programadas. Sin tests de frontend (no hay framework):
el helper se probó a mano con 6 escenarios.

## Deploy y visibilidad del repo (2026-10-24)

El workflow `deploy.yml` (push a `main`) hace `git pull origin main` en el VPS por
SSH. Con el repo **privado** falló: `ERROR: Repository not found` (el VPS no tiene
deploy key para este repo; el paso Checkout de Actions sí funcionó). Al volver el repo
a **público** el deploy corrió bien. Si se vuelve a hacer privado: crear una deploy key
de solo lectura para este repo en el VPS (alias propio en `~/.ssh/config`, sin tocar la
de forms-qsm), registrarla en Settings → Deploy keys y apuntar el remoto del VPS a ese
alias. El script reconstruye y recrea contenedores: antes de cualquier re-run, comprobar
que no hay envío en curso.

## Pendiente del usuario

1. **Decidir sobre el pixel** (detalle en `docs/legal/subencargados_email.md`;
   sigue presente en la 3.ª prueba, 2026-10-24 17:27 UTC): (a) buscar el ajuste de seguimiento en la
   configuración transaccional de Brevo y repetir la prueba; (b) aceptarlo como
   riesgo y documentarlo en el RAT, el contrato de encargo y con la organización
   Responsable; o (c) enviar solo por Resend (quitar `EMAIL_POOL`; 150/día).
2. **Envío masivo EN CURSO** (programado el 2026-10-24; ~1.236 destinatarios en
   el envío real, lotes de 450/día: Brevo 300 primero, Resend 150 después; el
   contador cambia a las 19:00 Ecuador). **El primer lote salió bien** entre
   Resend y Brevo. Mientras dure: no recrear `petition-api`, no cambiar
   `EMAIL_POOL` ni `.env`, no desplegar sin revisar `scheduled_send`/`send_batch`
   (lotes `pending`). Revisar `/comms/quota` cada día; si Resend consumió cupo
   por confirmaciones o boletín, su parte pasa al día siguiente.
3. T7 de `ses-transport`: prueba real en sandbox (opcional hasta que AWS
   apruebe); requiere usuario IAM `cauce-ses-sender` y access key.
4. Esperar a AWS; confirmar que el Configuration Set se llama `cauce-events`
   y que la alarma ComplaintRate sale de "Datos insuficientes".
5. ~~Actualizar RAT y contratos~~ **Hecho** (sin spec, por decisión del usuario):
   `app/legal/subencargados.py` + plantillas `rat.jinja2` y `contrato_encargo.jinja2`
   listan los subencargados desde la config (EE. UU.); 4 tests nuevos.
   **Minimización de datos en correos (mismo día)**: las comunicaciones solo
   aceptan la etiqueta `<nombre>` (primer nombre); `<nombre completo>`, `<cédula>`,
   `<correo>`, `<teléfono>`, `<provincia>` y `<organización>` se rechazan (422) y salen
   vacías si quedaron en un borrador. `signer_name.simple_name` unifica el saludo; el
   saludo ahora escapa HTML. Suite: 266 passed. Requiere desplegar API **y web**
   (editor) antes de enviar; no recrear `petition-api` con un envío en curso.
   **Pendiente para nuevas campañas** (`docs/legal/subencargados_email.md` §4):
   verificar garantías de cada proveedor, adenda para contratos ya firmados.
6. Abrir el PR a `main`. Incluye 4 commits previos de documentación
   (sesiones 42 y 43); revisar que se quiere publicar el runbook y los
   documentos legales.

7. **Próxima sesión / campaña — popup de cierre en la landing pública**
   (`popup-campana-cerrada` en `feature_list.json`, `pending`, sin spec aún).
   La campaña cerrada sigue recibiendo visitas: mostrarles un popup para
   suscribirse al mailing de novedades y seguir las redes de la campaña. Ojo:
   el alta va al boletín de listmonk con su propio doble opt-in, sin importar
   firmantes (`docs/legal/frontera_boletin_listmonk.md`); lleva PII (privacy_config)
   y diseño en Claude Design antes de implementar.

## Riesgos / ideas sin spec

- Resend se comparte con el boletín listmonk (el contador de la app no ve
  su consumo): poner Brevo primero en el pool.
- Las confirmaciones de firma siguen en `EMAIL_PROVIDER` (Resend Free
  agotado puede fallarlas); validado Brevo, evaluar `EMAIL_PROVIDER=brevo`.
- Falta webhook SNS de rebotes (`ses-bounce-handling`), `List-Unsubscribe`
  en `EmailMessage` y adaptador SMTP genérico. Plan B de MTA propio:
  no recomendado (entregabilidad, puerto 25, PTR, VPS compartido).
- El resto de pendientes de sesiones 42 y 43 (abajo) sigue vigente.

## Datos dev (sesión 44)

Alembic dev sin cambios (`041`, no hay migraciones). Suite: 258 passed.
Contenedor `petition-api-dev` reconstruido con `aioboto3`.

---

## (Previo) Estado tras sesión 43 (2026-10-22) — solo documentación

## Resumen de sesión 43

Sesión corta de documentación, sin cambios de código ni despliegue. Se
creó `docs/propuesta_de_valor.md` (propuesta de valor de la plataforma:
funciones técnicas, seguridad, practicidad, diferenciales como dominio
propio por campaña, y 14 mejoras propuestas). Cada capacidad está marcada
como implementada / parcial / propuesta, verificada contra el código.

**Estado de git**: 2 commits locales en `dev`, aún sin push:
`66912e8` (cierre sesión 43 + `.gitignore` que excluye la propuesta) y
`edda346` (`docs/diagrams/`, commit aparte). `docs/propuesta_de_valor.md`
queda **local, excluido del repo** por decisión del usuario.

**Hallazgos para decidir** (detalle en `progress/history.md`):
- No hay UI ni endpoints de admin para dar de alta un dominio propio por
  campaña; hoy es manual (fila en `domains` + DNS/Cloudflare). Candidato a
  feature nueva (spec) si se quiere vender "dominio propio" como
  autoservicio.
- Solo existe el adaptador de email de Resend; SMTP y los demás siguen
  solo en el diseño de `config-email-org`.
- `SECURITY_OVERVIEW.md` y `PROJECT_REFERENCE.md` (locales) están
  desactualizados: marcan como pendiente lo ya implementado.
- La cifra de 232 tests citada en el documento no se re-verificó.

**Pendiente de decisión del usuario**: si `propuesta_de_valor.md` se
reformula en tono comercial para versión pública; y validar la tabla comparativa con plataformas externas antes de
usarla en difusión.

Los pendientes de la sesión 42 (abajo) siguen vigentes sin cambios.

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
