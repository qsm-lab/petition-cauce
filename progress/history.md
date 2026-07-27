# Historial de sesiones — proy_petition-cauce


---

## 2026-07-27 — Sesión 40: centro-comunicaciones Fase 1 frontend + Fase 2 completas

Sesión larga de implementación pura. Se cerró todo lo que sesión 39 había
dejado pendiente de `centro-comunicaciones`: el frontend de la Fase 1 (la
pieza más grande) y toda la Fase 2 (subida de imágenes), backend + frontend.
Todo verificado con pytest y con navegador real (Playwright) — varios bugs
reales encontrados y corregidos en la verificación.

**Fase 1 frontend**: página nueva `/admin/campanas/[id]/comunicaciones` —
tipo de envío con badge de clase LOPDP, editor visual/código (soporte de
enlaces agregado a `RichTextEditor.tsx` compartido), CTA(s)+redes, audiencia
con checkboxes (guard anti-grupo-vacío) + conteo en vivo + cuota,
preview/prueba/confirmación de envío real, autosave local. Endpoint nuevo no
previsto en el diseño original: `GET .../comms/quota` con scope de campaña
(el existente es `platform_admin`-only, pero un `gestor` también necesita
verla). El popup `AdherentCommsModal` se mantiene — tiene campos
estructurados que el frame nuevo no reconstruye, decisión de retirarlo
pendiente del usuario. Bug real corregido: hydration mismatch de React
(`useDraft` leía `localStorage` en el inicializador de `useState`). A pedido
del usuario, se sumaron botones de acceso directo desde el editor de campaña
y desde firmas.

**Fase 2 (subida de imágenes)**: migración 039 (`comms_upload`, RLS),
sniffing de imagen por firma de bytes (sin `python-magic`/libmagic — evita
instalar paquetes de sistema con el contenedor sin red), endpoint de subida +
`GET /media/` público con cache inmutable, volumen persistente en
docker-compose (dev y prod), botón "Añadir medios" en el editor vía ref
imperativo de TipTap. Se corrigió `_uploads_origin()` (apuntaba al frontend
en vez de a la API, que es quien sirve las imágenes). 11 tests nuevos
(sniff, tamaño, aislamiento RLS entre orgs). Dos bugs más corregidos en la
verificación: CORS sin `Authorization` en `allow_headers` (ensanche
inofensivo, resultó ser falso positivo del propio script de prueba) y CSP
`img-src` sin la excepción dev para `localhost:8011` que `connect-src` ya
tenía (las imágenes no se veían en dev aunque el backend estaba bien).

**Infraestructura**: el contenedor `petition-api-dev` volvió a quedarse sin
red — `nh3` se perdió otra vez al recrear el contenedor para el volumen
nuevo (el fix de sesión 39 vivía en la capa efímera, no en la imagen);
mismo patrón de wheel-en-host-copiado-al-contenedor. El build del contenedor
web también falló (`corepack prepare pnpm` sin red) al agregar
`@tiptap/extension-link`/`@tiptap/extension-image`; se resolvió con `pnpm
install` en el host + copiar el paquete resuelto al store del contenedor +
symlink manual. `git fetch` siguió fallando toda la sesión (mismo timeout
SSH que en sesión 39). Pendiente de coordinar con el usuario: subir
`client_max_body_size` de nginx a 25M para que los uploads grandes funcionen
en producción (no tocado, regla del proyecto).

Suite completa: **201 passed** (190 al cierre de sesión 39).

**Cierre**: 6 commits (`3fc4908`…`eb35b94`), PR #19 (`dev` → `main`)
mergeado (`67b9641`), deploy corrido. Verificado desde este entorno tras el
deploy: web 200, `/api/health` OK, ruta `/media` responde. `git fetch` volvió
a funcionar al final (la falla de red de toda la sesión era del contenedor,
no del host) y confirmó `dev` == `origin/main` sin divergencia.

---

## 2026-07-26 — Sesión 39: sidebar + validación-cédula cerrados, config-email-org Fase 1 completa, centro-comunicaciones Fase 1 backend

Sesión larga de implementación pura (sin cambios de spec), todo verificado
con tests y con HTTP/navegador real (Playwright).

**`admin-sidebar-colapsable`**: implementada y verificada. Bug real
encontrado en la verificación (no al escribir el código): el ancho inline de
React le ganaba en especificidad a la regla CSS de colapso — el toggle no
hacía nada visualmente hasta corregirlo (clase Tailwind en vez de `style`).

**`validacion-cedula`**: spec retroactiva (sesión 24) — la lógica ya vivía en
producción; `test_cedula.py` ya estaba commiteado sin que `tasks.md` lo
reflejara. Solo faltaba el test de integración contra `create_signature` real.

**`config-email-org` Fase 1 completa**: contador de cuota Redis por
credencial (provider-agnóstico + snapshot de headers Resend), rate limit del
endpoint de test, alta de organización materializa su `org_email_config`
inicial (sin credenciales por seguridad), y el frontend (card en perfil de
org, con mockup aprobado primero). Bug de UX corregido: la pill no debe decir
"configurada" solo porque existe una fila de config sin credenciales reales.
Bug de infraestructura descartado con evidencia: los 500 intermitentes al
crear organizaciones eran una carrera con el `--reload` del dev server, no un
bug real (7/7 éxitos seguidos sin ediciones de por medio).

**`centro-comunicaciones` Fase 1 backend**: `comms_service.py` (sanitización
`nh3`, segmentación por clase LOPDP R8-R11, armado de HTML con CTA+redes) + 3
endpoints en `campaigns.py` (recipients/count, preview, send) + 13 tests.
Remitente y cuota resueltos por `config-email-org`, nunca definidos en el
centro. Falta el frontend (TipTap + audiencia + preview), la parte más
grande de la Fase 1.

**Infraestructura**: el contenedor `petition-api-dev` se quedó sin salida a
internet a mitad de sesión (bloqueó `pip install nh3` y, brevemente,
`git fetch` en el host) — se resolvió instalando `nh3` desde un wheel
descargado en el host (que sí tenía red) y copiado al contenedor; luego el
usuario reconectó la red general y todo volvió a la normalidad.

Suite completa: **190 passed** (era 171 al cierre de sesión 38).

`progress/current.md`/`history.md` de sesión 38 habían quedado redactados sin
commitear — se reescribieron con el estado real de ambas sesiones juntas.

---

## 2026-07-26 — Sesión 38: cierre de sesión 37 — 5 commits + PR #18 mergeado a main

Sesión corta de cierre. Todo el trabajo que sesión 37 había dejado sin
commitear en el working tree de `dev` (specs + embudo-post-firma + fundación
de config-email-org) se dividió en **5 commits lógicos**: fix `_social_href`,
`embudo-post-firma` (migración 036, con `git add -p` para separar el hunk de
`_social_href` del refactor de `_send` que compartían el mismo archivo),
núcleo backend de `config-email-org` (migración 038), specs nuevas, y cierre
de sesión 37. El commit de embudo se hizo primero sin título por error
(`82d9607`) — corregido con `git commit --amend` antes de push.

Hallazgo al armar el PR: `origin/main` ya tenía mergeado el PR #17 con todo lo
de sesión 36 (`99aea11`), contradiciendo la nota de `current.md` de sesión 37
que decía "pendientes de PR a main" — el PR de esta sesión solo necesitó
cubrir los 5 commits nuevos.

El usuario abrió y mergeó **PR #18** (`dev`→`main`, `753641d`), que dispara
`deploy.yml` a producción. **No verificado en esta sesión** si el deploy
corrió bien en el VPS ni si Alembic llegó a `038` en producción — primer
pendiente de la próxima sesión, con prioridad por el fix de RLS (`037`) que
corrige un bug activo.

---

## 2026-07-24/25 — Sesión 37: diseño SDD de 4 features + implementación de embudo-post-firma y del backend de config-email-org

Sesión larga de diseño e implementación. Al inicio se confirmó que el deploy de
sesión 36 (PR #17) ya está en producción (`d872706`, Alembic `035`). Todo el
trabajo de esta sesión quedó en el working tree de `dev` **sin commitear**.

**Pendientes de sesión 36 cerrados:** fix `_social_href` (antepone `https://` a
social_links sin esquema, con test); reconfirmado el trade-off del portal ARCO
(aceptado); borradas 3 ramas locales (hallazgo: `fix/recordatorio-todas-
visibilidades` tenía 1 commit no en `main`, pero su cambio ya estaba
re-implementado en `dev`); el hallazgo del checkbox `notify_updates` roto derivó
en la feature `embudo-post-firma`.

**Cuatro specs nuevas** (con diseños Claude Design y decisiones tomadas con el
usuario): `embudo-post-firma`, `config-email-org`, `centro-comunicaciones`
(7 frames, absorbe `comunicaciones-cierre-campana` +
`programacion-historial-comunicaciones`), `admin-sidebar-colapsable`. Decisiones
clave: email multi-proveedor **por organización** (campaña solo cosmético,
Fase 1 solo Resend); clave de cifrado dedicada; administra `platform_admin`;
renombre de producto **"novedades" → "Anuncios"**; token dedicado para el
consentimiento post-firma; cuota de Resend legible por headers `x-resend-*-quota`.

**`embudo-post-firma` — IMPLEMENTADO y verificado** (migración `036`): cablea el
consentimiento de Anuncios post-firma (`newsletter_token` efímero devuelto al
crear la firma → `PATCH .../signatures/newsletter-consent` → setea
`notify_updates`+`notify_updates_at` sin tocar `status`). Frontend `StepThanks`
con 5 estados de micro-feedback + renombre a "Anuncios". Suite **167 passed**,
`tsc` limpio, flujo HTTP e2e real en dev.

**Migración `037` — fix bug latente de PRODUCCIÓN:** la policy RLS
`arco_requests_org_admin` (mig. `035`, ya en prod) usa el patrón
`!= '' AND ::uuid` que falla con `''::uuid` cuando una conexión del pool queda
con `app.current_org_id=''` — misma regresión que `021`/`031` corrigieron en
`consents`. Reescrita con guard `NULLIF`. Descubierto por los tests de embudo;
afecta producción actual.

**`config-email-org` — núcleo backend implementado** (migración `038`): cifrado
dedicado de credenciales (`sec:v1:`, fallback a `pii_encryption_key`); modelo
`OrgEmailConfig` con RLS `NULLIF`; transporte multi-proveedor (`email_transport.py`:
`EmailTransport`, `ResendTransport` con captura de headers de cuota,
`resolve_transport_for_org`, `resolve_sender`); **refactor de `_send`
retrocompatible** (todos los emails pasan por la abstracción); capa admin (service
+ endpoints CRUD/test bajo `/v1/admin/organizaciones/{id}/email-config`, solo
`platform_admin`); properties `sender_*` en `Campaign.meta`. Tests
`test_config_email_org.py` (14) + smoke test HTTP (la api_key nunca se expone).
Pendiente: integración de la resolución con los flujos de email, contador de
cuota Redis y frontend — todo junto con `centro-comunicaciones`.

**Cadena de migraciones** (dev local en `038`, prod en `035`):
`035 → 036 embudo → 037 fix-RLS-arco → 038 org_email_config`, todas reversibles;
`039+` sería el centro. **Nada de esto está commiteado ni en producción.**

**Cierre:** Docker daemon se cayó al final (relevantar con
`docker compose -f docker-compose.dev.yml up -d`).

---

## 2026-07-23/24 — Sesión 36: resolución de los 2 hallazgos LOPDP de sesión 35 + implementación de /mis-datos

Continuación directa de los pendientes 🔴 que sesión 35 dejó ya en
producción. Los 3 quedaron resueltos en `dev`, commiteados y pusheados a
`origin/dev` — el PR a `main` y el deploy quedan para la próxima sesión.

**RLS faltante en `retention_runs`/`arco_requests` (commit `a615ac3`):**
migración `035` con policy única `platform_admin` en `retention_runs`
(no tiene columna de scoping por org) y columna `org_id` denormalizada +
trigger `BEFORE INSERT` + políticas `org_admin`/`platform_admin` en
`arco_requests` (mismo patrón que `pii_export_audit`, sin tocar los ~9
sitios de la app que insertan filas). Verificado en dev con una llamada
HTTP real: la fila de auditoría quedó invisible sin contexto de sesión y
visible con `is_platform_admin` — RLS funcionando de punta a punta.

**`anonymize_signature()` no limpiaba `celular_encrypted` (commit
`711004f`):** fix de una línea + regresión nueva en `test_retention.py`.
Confirmado antes del fix que el cron de retención (03:00) aún no había
corrido en producción desde el deploy de sesión 35 — no hizo falta
script de corrección de datos históricos.

**Frontend `/mis-datos` + `/mis-datos/portal` (commit `4123212`):**
hallazgo clave antes de implementar — el diseño ya estaba **aprobado
desde sesión 30** (`specs/derechos-arco/design-export.html`), algo que
`progress/current.md` de sesión 35 decía erróneamente que faltaba. Se
confirmó que la paleta/tipografías del diseño coinciden con los tokens
vigentes (`globals.css`) — no estaba desactualizado. Implementado directo
sobre ese diseño (decisión explícita del usuario, sin nueva ronda de
Claude Design): formulario de solicitud + confirmación anti-enumeración,
portal multi-campaña 3 niveles, modal de supresión. Cliente
`arco-api.ts` nuevo (primer uso de Bearer token en el frontend). Probado
con llamadas HTTP reales contra el backend en dev (firma de prueba +
token inyectado en DB para simular el email) ejerciendo todos los
endpoints que usa el frontend, y revisado manualmente en navegador por
el usuario — confirmado OK.

`specs/derechos-arco/tasks.md`: T13/T14 marcados `[x]`.

**Git:** también se sincronizó `main` local contra `origin/main`
(pendiente que había quedado de sesión 35 — `git reset --hard
origin/main`, ya no había commits propios que perder).

---

## 2026-07-23 — Sesión 35: revisión de riesgo pre-PR, retorno al flujo dev→PR→main, deploy a producción

Sesión de cierre del ciclo abierto en sesión 34: se revisó en profundidad
el diff de los 8 commits LOPDP pendientes (`origin/main..main`,
~4660 líneas/55 archivos) antes de mandarlos a producción, se retomó el
flujo normal de ramas, y se deployó.

**Revisión de riesgo (subagente + verificación manual directa en código):**
dos hallazgos confirmados que **no se corrigieron esta sesión** (quedan
en la DB de producción tal cual):
- `retention_runs` y `arco_requests` (migraciones `018`/`019`) se crean
  **sin RLS** — inconsistente con `pii_export_audit` (migración `030`),
  que sí lo tiene. Contradice la regla del proyecto de RLS desde la
  migración inicial.
- `anonymize_signature()` (`retention_service.py:36-47`) **no limpia
  `celular_encrypted`** — el campo se agregó en la migración `022`,
  posterior a esa función, que nunca se actualizó. Afecta las 3 vías de
  supresión (job de retención, archivado admin, autoservicio ARCO).

Otros puntos anotados sin acción: acceso al portal ARCO vía email de
confirmación sin Turnstile/2FA (ya especificado y decidido en el spec,
solo se pidió reconfirmación), fallback de URL faltante en
`_social_icon_links()` de `email_service.py` (bajo riesgo).

**Retorno al flujo dev→PR→main:** el usuario confirmó que el flujo
correcto es `dev` fijo en local → PR en GitHub → `main`, con deploy
manual aparte — lo hecho en sesión 34 (merge local `dev`→`main`) fue una
excepción puntual, no el patrón a repetir. Se pusheó primero los 7
commits que llevaban congelados en `dev` local desde sesión 34 (nunca
habían llegado a `origin/dev`), y por separado 3 commits nuevos ya
verificados como de bajo riesgo:
- `f4198f3` fix de `test_supresion_admin.py` (parámetro `role` faltante
  tras el merge de sesión 34).
- `0e21626` spec nueva `landing-respaldo-entrega` (`spec_ready`, sin
  implementar).
- `7b24a8c` docs de cierre de sesión 34.

Se armó PR #16 `dev → main` en GitHub (título y descripción preparados
por Claude, incluyendo los 2 hallazgos de RLS/`celular_encrypted` como
"pendientes conocidos" en el cuerpo del PR) y el usuario confirmó que ya
se mergeó y se deployó a producción.

**Memoria actualizada:** `feedback_git_workflow.md` — flujo confirmado
`dev` fijo → PR GitHub → `main`, deploy manual separado.

---

## 2026-07-21/22 — Sesión 34: reconciliación completa de dev y main (2 semanas divergidos)

El usuario confirmó el cierre de la campaña real y pidió retomar `dev`,
resolviendo cualquier commit/función pendiente en ramas temporales. Lo que
parecía una limpieza de ramas terminó siendo una reconciliación de fondo:
`dev` y `main` llevaban divergidos desde sesión 27 (2026-07-08) por dos
líneas de trabajo que nunca se habían cruzado. `main` tenía 5 PRs
(`fix/dashboard-firmas-entrega`, `feat/comunicaciones-cierre-campana` x2)
que `dev` no tenía; `dev` tenía 3 features LOPDP completas de sesión 30
(`retencion-datos`, `supresion-admin`, `derechos-arco`) que **nunca se
habían pusheado a `origin`** — el `origin/dev` remoto se había recreado
desde `main` en algún punto, perdiendo esa referencia (nada se perdió,
seguían en el reflog local). Un commit adicional (`fe70bf3`, fix de
íconos PNG de sesión 33) había quedado huérfano: se pusheó después de que
el PR de esa rama ya se había mergeado.

Con aprobación explícita del usuario en cada paso: se rebasaron los 3
commits LOPDP sobre el `origin/dev` real, resolviendo 8 conflictos de
código genuinos (dos features tocando los mismos archivos —
`admin_signatures.py`, `admin_signature_service.py`, `email_service.py`
con funciones ARCO entrelazadas línea a línea con las de
comunicaciones-cierre-campana, `models/__init__.py`, `feature_list.json`,
`progress/history.md`); se trajo el commit huérfano a `dev`; y se detectó
un **doble head de Alembic** generado por la propia reconciliación
(cadena LOPDP `018→022` vs cadena export-entrega `030→033`, ambas desde
`017` — el riesgo que ya estaba anotado en sesiones previas), resuelto
con una migración de solo-merge (`034_merge_lopdp_export_heads.py`, sin
cambios de schema). Se mergeó `dev` → `main` (`8fe69f9`).

Todo se verificó contra Docker real (no solo lectura de código):
`alembic upgrade head` corrió limpio de punta a punta hasta el head único
`034`; `pytest` encontró 1 test roto por el propio merge
(`test_supresion_admin.py` llamaba a `export_csv()` sin el parámetro
`role` que había agregado otra feature ya integrada) — corregido,
**148/148 tests pasan**; `tsc --noEmit` limpio. Se restauró también el
trabajo pendiente de sesión 33 (`feature_list.json` + spec completa de
`landing-respaldo-entrega`) sobre el `main` ya reconciliado.

**Nada se pusheó ni se pulleó** — a pedido del usuario, de acá en
adelante todo push/pull y todo commit adicional es manual. `main` local
quedó 8 commits por delante de `origin/main`, y el fix de test +
`feature_list.json` + la spec nueva quedaron sin commitear, esperando
revisión del usuario. Sin decidir todavía: borrar las ramas locales ya
redundantes (`fix/dashboard-firmas-entrega`, sin commits propios;
`fix/recordatorio-todas-visibilidades`, su único commit ya está en `main`
bajo otro hash idéntico; `feat/comunicaciones-cierre-campana`, ya
integrada vía `dev`).

---

## 2026-07-20 — Sesión 33: fixes sobre comunicaciones-cierre-campana (hora local, formato de mensaje, íconos PNG) + spec landing-respaldo-entrega

PR de sesión 32 en revisión en producción (`feat/comunicaciones-cierre-campana`,
sin mergear en ese momento). Se verificó primero que el cambio de etapa
de ciclo de vida NO dispara mailing masivo a adherentes (estaba bien
separado desde sesión 32, no era un bug). Luego 2 fixes reportados desde
el VPS sobre el email de invitación al evento: **hora en UTC en vez de
hora local de Ecuador** (el navegador manda la hora en UTC,
`_fmt_event_datetime` no la reconvertía — fix con `zoneinfo`/
`America/Guayaquil`) y **sin formato en "mensaje adicional"** (se agregó
`_render_message_html`: escapa el input del admin —cierra un XSS que
tenían las 3 plantillas— y soporta `**negrita**`, `*cursiva*`, saltos de
línea y párrafos; toolbar B/I en el frontend). Se confirmó además que la
personalización con nombre real del firmante sí funciona en el envío
masivo real (el "Nombre" que se ve en preview/prueba es un placeholder
intencional, no atado a ningún firmante).

Los 2 fixes se prepararon como 2 commits separados sobre la misma rama
del PR, y se entregó título/descripción de PR al usuario. Con un envío de
prueba real hecho desde el VPS, el usuario compartió 3 warnings de
deliverability de Resend: 2 inherentes/no accionables y **1 bug real**:
"Avoid SVG images" — Gmail no renderiza `<svg>` inline, así que los
íconos de redes sociales (elegidos como SVG en sesión 27 para evitar el
bloqueo de Gmail a `data:` URI) probablemente no se veían en absoluto
para destinatarios Gmail. Se rasterizaron los 8 íconos a PNG (círculo +
glifo horneado, mismos trazos/colores, con `rsvg-convert` instalado
temporal en el contenedor dev) alojados en
`apps/web/public/icons/social/` — 3er commit al mismo PR, pusheado (este
commit, `fe70bf3`, quedó huérfano tras el merge del PR y se reconcilió
recién en sesión 34, ver arriba).

**96/96 tests, `tsc --noEmit` limpio.** Verificado end-to-end contra la
API real de dev (curl/httpx): hora convertida correctamente, mensaje con
negrita/cursiva renderizado, 0 `<svg>` y URLs de íconos PNG resolviendo
200.

Pedido nuevo del usuario: landing pública informativa (detalles de
campaña, cuantificación de firmas por tipo/origen, fechas, seguridad,
fiabilidad de firmas, resumen de privacidad) en URL única + QR, para
adjuntar al documento de entrega como soporte ante la autoridad
receptora. Se armó spec completa sin implementar nada
(`specs/landing-respaldo-entrega/`: requirements.md de 18 R, design.md,
tasks.md) + entrada nueva en `feature_list.json`
(`landing-respaldo-entrega`, Fase 4, `spec_ready`). Decisiones tomadas
con el usuario: URL `/c/{slug}/respaldo` (subruta existente), contenido
de seguridad/fiabilidad/privacidad fijo por plataforma (no editable por
campaña), y debe seguir accesible con la campaña archivada/cerrada. Sin
migraciones. Queda pendiente la aprobación de la spec y el diseño en
Claude Design antes de implementar.

---

## 2026-07-20 — Sesión 32: comunicación con adherentes (evento, cierre, mensaje) + 2 fixes puntuales — mergeado y deployado

Cierre de la campaña real (`soberania-tlc-ecu-usa`) en curso. Rama
`feat/comunicaciones-cierre-campana`, partida de `main` a pedido explícito
del usuario (`dev` sigue con su cadena LOPDP sin mergear). **PR #12
mergeado y deployado.** Luego, un fix adicional post-deploy (**PR #13,
también mergeado y deployado**): `remind_pending_signatures` ("Recordar a
pendientes") dejó de filtrar `visibility='publica'` — ahora abarca
también `anonima`/`secreta`, sin necesitar copy de email nuevo (gap
documentado desde sesión 31). Uso previsto: recordatorio único en
producción a toda adhesión sin confirmar hasta el cierre de la campaña.

**2 fixes puntuales** (parte de PR #12): columna `org` en el CSV normal
del dashboard de firmas; corrección del conteo público
(`get_signature_count`/`get_total_signature_count`) excluyendo firmas
`name IS NULL` — caso especial hardcodeado solo para `soberania-tlc-ecu-usa`
(el bug de origen del nombre nulo ya se corrigió en sesión 31, no se
generaliza a otras campañas).

**Feature grande — "Comunicación con adherentes"**: popup único con 3
pestañas (invitación al evento de entrega, aviso de cierre, mensaje libre)
que reemplaza y consolida lo que antes era el botón suelto "Notificar a
firmantes". Cada pestaña: formulario → vista previa real (HTML exacto
renderizado por el backend, mostrado en iframe) → envío de prueba a
direcciones libres → envío real con conteo de destinatarios y
confirmación. Invitación al evento: personalizada por nombre del
firmante, con links de agendar (Google Calendar/Outlook/Apple Calendar vía
endpoint `.ics` nuevo) y redes sociales de la org en íconos SVG inline
(no `data:` URI, evita el bloqueo de Gmail ya conocido desde sesión 27).
Aviso de cierre: mismas funciones que el de evento salvo fecha/hora/lugar.
Bloque "Impulsado por: {org}" en ambos. Borradores autoguardados en
localStorage (sin backend). 2 campos nuevos en redes sociales del editor
admin: X y Email (arma `mailto:` solo). 88/88 tests, `tsc --noEmit` limpio,
verificado en vivo contra dev vía curl/httpx — **sin probar en navegador
real** (sin herramienta de browser disponible esta sesión).

**Hallazgo documentado sin corregir**: `Consent.notify_updates` nunca se
capturó de verdad (checkbox roto en `StepThanks.tsx`/`SignFlow.tsx`) —
ninguno de los 3 tipos de envío filtra por ese consentimiento; la base
legal usada es que informar del cierre/evento es parte del proceso mismo
de la petición firmada, no marketing opcional.

**2 specs nuevas quedan para la próxima sesión**: `programacion-historial-comunicaciones`
(`spec_ready` — programar envío + historial, primera migración de esta
rama, prioridad: programar primero) y `email-cumplimiento-masivo`
(`pending`, sin spec — términos/privacidad/desuscripción/ver en navegador
para todos los emails masivos).

Pendiente confirmar si el congelamiento de `dev` ya se liberó (dicho para
hoy, 2026-07-20) y si la campaña real ya cerró — no confirmado dentro de
esta sesión.

---

## 2026-07-12/13 — Sesión 30: fix ArchiveModal + derechos-arco (backend completo, multi-campaña)

Sesión larga con varias rondas de diseño iterativo a pedido del usuario — el
alcance de `derechos-arco` creció de "una campaña" a "toda la plataforma"
sobre la marcha. Reconstruyo el arco completo abajo porque el diseño final es
bastante distinto del planteo inicial.

### Fix previo: `/admin/campanas/[id]/firmas` daba 500

`ArchiveModal.tsx` (client component) importaba `archiveSignature`/
`unarchiveSignature` desde `admin-signatures-api.ts`, módulo que también
contiene `apiServer` (usa `next/headers`, solo válido en Server Components).
El import en tiempo de ejecución arrastraba ese código server-only al bundle
del cliente. Se movieron esas dos funciones fuera del módulo —
`ArchiveModal.tsx` ahora llama `api.post(...)` directamente, mismo patrón que
`VisibilityCell.tsx` ya usaba correctamente.

### `derechos-arco` — primera pasada (una campaña, luego superada)

Implementación inicial acotada a una campaña (verificación email+cédula,
sesión de portal JWT 30 min, los 5 derechos ARCO clásicos). Entré en modo
Plan antes de implementar; plan aprobado. Se creó la migración
`020_arco_verification.py` (`signatures.arco_verification_token`/
`expires_at`, reutilizando la `arco_requests` ya creada por `supresion-admin`
en la `019` — la spec original mencionaba migración `017` y recrear la
tabla, desactualizado, corregido).

**Bug de infraestructura encontrado y corregido durante la verificación
manual**: `consents_org_admin` (RLS, migración `006`) nunca recibió el mismo
fix de guard `NULLIF` que `sig_org_admin` sí recibió en la migración `008` —
con `app.current_org_id` sin setear, Postgres podía evaluar el cast `::uuid`
de una cadena vacía y romper con `invalid input syntax for type uuid: ""`
(no garantiza cortocircuito de AND/OR en policies RLS combinadas). Expuesto
por ser el primer flujo que alterna `app.current_org_id` dentro de la misma
sesión antes de tocar `consents`. Corregido en migración
`021_fix_consents_rls.py`, mismo patrón que la `008`.

### Pivote a multi-campaña (a pedido del usuario)

El usuario pidió: (1) reconocer que un firmante puede tener firma pendiente
sin confirmar cuando entra a ARCO, y (2) que la misma persona puede haber
firmado varias campañas — el portal debía agruparlas, no vivir atado a una.
Reescritura completa de `arco_service.py`:

- **Búsqueda platform-wide**: `request_access`/`verify_token` ya no reciben
  `campaign_id` — buscan por email_hash+cedula_hash en toda la plataforma,
  usando el bypass `app.is_platform_admin` (mismo patrón que
  `retention_service.run_retention` para operar sin conocer de antemano el
  `org_id` de cada fila).
- **Token ancla + re-consulta**: `arco_verification_token` tiene constraint
  `UNIQUE`, así que no puede replicarse en todas las firmas encontradas — se
  ancla a UNA fila (la de la campaña de origen si se indicó); al verificar,
  se re-consulta el conjunto vigente por esos mismos hashes, así la sesión
  siempre refleja el estado más reciente.
- **Sesión de portal multi-firma**: JWT con `signature_ids: [...]` (lista, no
  un solo id) + `origin_campaign_id` + `auto_confirmed_ids`.
- **Auto-confirmación al verificar (R1c)**: si una firma está
  `pending_confirmation` y su campaña sigue firmable, se confirma
  automáticamente al abrir el portal (el enlace ARCO ya prueba la
  titularidad del email). Si la campaña ya cerró, se omite pero se conserva
  el acceso para gestionar el registro.
- **Confirmación manual (R14)**: nuevo `confirm_pending`, habilitado solo si
  `pending_confirmation` + campaña firmable.
- Router movido de `/v1/public-campaign/{campaign_id}/arco/*` a `/v1/arco/*`
  (ya no tiene sentido anclado a una campaña).
- **Acceso directo sin formulario (R15)**: `signature_service.confirm_signature`
  emite un token de acceso directo (24h) al confirmar, incluido como CTA
  "Gestionar mis datos" en el email de agradecimiento — entra derecho al
  portal, sin pasar por `/mis-datos`.
- **Botón en landing (R16)**: agregado inicialmente en `ActionBlock.tsx`,
  luego MOVIDO (a pedido del usuario, tras revisar en el navegador) a
  `RecentSignatures.tsx`, como link fuera de la tarjeta, al final de la
  sección.

### Rectificación de email/cédula/celular (a pedido del usuario)

El usuario pidió poder corregir también email y cédula (no solo
nombre/provincia), más un campo nuevo opcional (celular), y me pidió
analizar las implicaciones antes de implementar:

- `celular_encrypted` (migración `022`) — cifrado, sin hash/índice, nunca
  formó parte de lo entregado, siempre editable.
- Email/cédula son únicos **por campaña** (índices `uq_sig_email_*`/
  `uq_sig_cedula_natural`, migración `006`, partidos por `signer_type`) — a
  diferencia de nombre/provincia. `rectify_personal_data` detecta el choque
  campaña por campaña (`_has_collision`) y aplica donde puede, reportando
  conflictos en vez de fallar todo (decisión explícita del usuario: "aplicar
  donde se pueda, avisar el resto").
  Si el email cambia en una firma `pending_confirmation`, se reenvía la
  confirmación automáticamente al correo nuevo. El aviso de seguridad del
  cambio (R18, nuevo `send_arco_change_notification`) va al correo
  **anterior**, no al nuevo.

### Reestructuración final: qué es compartido vs. por campaña

Tras un ida y vuelta sobre qué pasa cuando una campaña ya cerró (¿se congela
todo? ¿solo algunos campos? ¿cuándo exactamente?), quedó así (decisión final
del usuario, revirtiendo una propuesta intermedia de congelar al confirmar):

- **Nivel 1 — compartido** (`rectify_personal_data`): nombre, email, cédula,
  celular. Nombre/email/cédula ("datos esenciales para la firma") se
  congelan **por campaña cerrada** — pudieron usarse en la entrega formal;
  el intento de cambiarlos en esa campaña puntual se reporta como conflicto
  (`reason="campana_cerrada"`) sin bloquear las demás campañas activas de la
  sesión. Celular siempre editable, incluso con campaña cerrada.
- **Nivel 2/3 — por campaña** (nuevo `update_campaign_profile`): tipo de
  firmante y ubicación (Ecuador/internacional) son estructurales — editables
  **solo** si la firma sigue `pending_confirmation` Y la campaña acepta
  firmas (mismo criterio que el alta original: se eligen una vez).
  Provincia/país NO son "esenciales para la firma" — editables siempre,
  independiente del estado.

### Email de confirmación con revisión (R19, nuevo)

El email de confirmación original (doble opt-in) ahora muestra un resumen de
lo ingresado ("revisa que tus datos hayan quedado bien escritos") + un
enlace secundario, visualmente menor al botón principal, que entra directo
al portal para corregir antes de confirmar — evita tener que rectificar
después. Ajuste fino a pedido del usuario: el resumen **nunca** incluye el
correo (que el mensaje haya llegado a la bandeja ya prueba que estaba bien
escrito) — solo nombre completo + cédula siempre, y organización/ubicación/
celular condicionalmente si la campaña los pidió y el firmante los completó.

### Celular configurable por campaña (R20, nuevo)

Toggle "Solicitar celular" en el panel "Configuración formulario" del editor
de campaña (`form_config.request_celular`, default `false`) — wireado hasta
`StepForm.tsx` (campo opcional en el alta original, no solo vía ARCO).

### Verificación

- 42 tests en `test_arco.py`, **109 tests API en total, todos en verde**.
- `tsc --noEmit` sin errores en el frontend.
- Verificación manual end-to-end vía HTTP con escenarios reales: firma en
  campaña activa+confirmada, campaña activa+pendiente (auto-confirmó al
  verificar), campaña cerrada+pendiente (NO se auto-confirmó, `confirm`
  manual rechazado con 409) — mismo email+cédula, 3 campañas agrupadas en
  una sesión, acciones aisladas por campaña confirmadas en DB, auditoría
  completa sin PII. Datos de prueba limpiados en cada corrida.

### Pendiente para después

1. Frontend `/mis-datos` + portal en Next.js (T13-T14) — diseño ya aprobado
   en `specs/derechos-arco/design-export.html`.
2. Decisión abierta: ¿implementar "perfil histórico de firmante" (reconoce a
   la misma persona entre campañas, pre-llena datos, verifica consistencia
   de nombre/cédula) como feature nueva? No está en `feature_list.json` — el
   usuario prefirió dejarlo como decisión a tomar más adelante en vez de
   improvisarlo dentro de esta sesión.
3. Viabilidad a diseñar: qué hacer cuando el email de confirmación nunca le
   llega al firmante (typo o problema del proveedor de correo), ni dentro de
   las 24h ni después de expirar — hoy no hay recurso real (`resend-confirmation`
   reenvía al mismo correo; el flujo ARCO también depende de ese correo).

---

## 2026-07-11 — Sesión 29: supresion-admin implementada

**Bloqueo de spec resuelto**: `supresion-admin` (design.md) dependía de la
tabla `arco_requests`, propia de `derechos-arco` — aún `spec_ready`, sin
migración ni modelo. Es una dependencia circular real entre las dos specs.
Con aprobación del usuario, se creó `arco_requests` adelantada en la
migración `019`, con el esquema ya definido en `specs/derechos-arco/design.md`
(R10). `derechos-arco` reutilizará esta misma tabla cuando se implemente —
nota dejada en `feature_list.json` para no recrearla.

**`supresion-admin` (fase 3, LOPDP) implementada completa**: botón "Archivar"
en el dashboard de firmas (ventana de gracia de 15 días, reversible). Migración
`019` (`signatures.archived_at/archived_by/purge_after` + `arco_requests`),
`admin_signature_service.archive_signature`/`unarchive_signature` con
auditoría ARCO (email_hash, sin PII), `email_service.send_archive_notification`,
exclusiones de firmas archivadas en export CSV / notificaciones de novedades /
feed de recientes (activas desde el archivado, no esperan la purga), y
reutilización de `retention_service.anonymize_signature` — la cola de purga de
archivadas corre en el mismo job/scheduler diario de `retencion-datos` (un
solo mecanismo, ahora dos disparadores). Endpoints
`POST .../signatures/{id}/archive` y `/unarchive`, exclusivos rol admin.
Frontend: columna de acciones + `ArchiveModal.tsx` (confirmación 2 pasos) +
badges "Archivada — purga el X" / "Suprimida" — sin ronda de Claude Design
(adiciones a pantalla existente, ya contemplado en el design.md aprobado).

**Verificación**: 73 tests (8 nuevos) ✓. Prueba end-to-end manual vía HTTP con
login real de admin sobre una firma de prueba en `prueba-001`: archivar →
excluida de feed/export/notify → restaurar → re-archivar → purga forzada
(`purge_after` al pasado) → job de retención → conteo de la campaña intacto,
PII eliminada. Las firmas reales de `prueba-001` no se vieron afectadas
(confirmado antes y después); datos de prueba limpiados (`signatures`,
`arco_requests`).

**Estado al cierre**: migración 019 aplicada en dev, en espera de deploy a
producción (congelamiento por campaña real activa vigente). Nada commiteado
aún de sesión 28 ni 29 — el usuario revisa y commitea manualmente. Siguiente:
`derechos-arco` (ya no tiene el bloqueo de `arco_requests`) o `export-entrega`
si el usuario prioriza la entrega.

---

## 2026-07-09 — Sesión 28: retencion-datos implementada

**Corrección de estado**: `export-entrega` estaba marcada `done` en
`feature_list.json` por error (sin ningún commit de implementación real,
verificado con `git log --all`); revertida a `spec_ready` con confirmación
del usuario.

**`retencion-datos` (fase 3, LOPDP) implementada completa**: migración `018`
(`signatures.anonymized_at` + tabla auditoría `retention_runs`),
`retention_service.py` (ancla por evento `entrega` o `created_at`,
anonimización de campos identificantes preservando los agregables),
`scheduler.py` (APScheduler diario 03:00 Guayaquil + lock Redis compartido
con el endpoint manual), `POST /v1/admin/retention/run`.

**Verificación**: 65 tests (8 nuevos) ✓. Prueba end-to-end manual vía HTTP con
login real de admin, confirmando que las campañas reales no se ven afectadas
y el contador de landing queda intacto.

**Regla nueva del usuario**: hay una campaña real activa en producción
(`soberania-tlc-ecu-usa`) — todo cambio significativo (deploys, migraciones)
espera al cierre de la campaña. Se sigue avanzando en local; en paralelo
habrá ajustes menores de contenido en producción.

**Estado al cierre**: migración 018 aplicada en dev, en espera de deploy a
producción. Siguiente: supresion-admin (reutiliza `anonymize_signature`) →
derechos-arco; `export-entrega` puede intercalarse — todo en local por ahora.

## 2026-07-08 — Sesión 25: cifrado-reposo en producción + rectificaciones y pulido

**cifrado-reposo implementado y desplegado**: AES-256-GCM (`enc:v1:`), clave
obligatoria, migración 015 idempotente; verificado en prod (firmas reales
cifradas). TEST-5 cerrado: flujo de firma completo funcionando en producción.

**8 rectificaciones admin/front** (specs/detalle en current.md): aviso de
privacidad conectado a la política asignada, emails con branding de la org y
título público, RLS multi-org para el admin de plataforma (migración 016),
orden móvil, adjuntos sin descarte silencioso, ciclo de vida con Diálogo/
Decisión opcionales, CTA flotante solo móvil, y cambio de visibilidad
solicitado por admin con confirmación por email del titular (migración 017).

**Patrón de bug recurrente corregido (x3) y registrado en memoria**: display
inline anula clases Tailwind responsive (md:hidden).

**Pulido UI final**: orden del ActionBlock con hover en CTA, contador centrado,
riel de etapas centrado, icono real de WhatsApp, documentos adjuntos
destacados en móvil y CTA flotante simplificado.

**Estado al cierre**: 57 tests; migración 017 en prod; primera campaña real
activa con firmas confirmadas. Siguiente: retencion-datos → supresion-admin →
derechos-arco.

---

## 2026-07-07 — Sesión 24: specs LOPDP fase 3 + tests + validación local

Trabajo local mientras el usuario ejecutaba TEST-5/6/7 en el VPS.

**Desincronizaciones:** `editor-branding` → in_progress; spec retroactiva de
`perfiles-org`; tasks.md de features implementadas actualizados.

**Specs nuevas (spec_ready):** `cifrado-reposo` (AES-256-GCM, urgente antes de
la primera campaña real), `retencion-datos` (job APScheduler + anonimización),
`derechos-arco` (portal self-service), `enlace-corto-qr`, `validacion-cedula`
(retroactiva — ya estaba implementada).

**Tests:** infraestructura pytest reparada (no estaba instalado en el contenedor);
`pytest.ini` con loop de sesión; 4 suites nuevas → 46 tests pasan.

**repo-docs:** README.md + LICENSE AGPL-3.0 creados.

**Validación local:** resumen-admin, dashboard-firmas, editor-campana,
editor-branding, ciclo-vida-admin/básico, firmas-recientes y OG verificados
por API y SSR; hallazgos menores registrados en los tasks.md respectivos.

**Producción — primera campaña real (`soberania-tlc-ecu-usa`), fixes sobre la marcha:**
- Landing 404: doble causa — `domain_service` filtraba `tls_status='activo'`
  (el constraint solo permite `'active'`) y tabla `domains` vacía. Fix +
  adopción del **patrón forms-qsm `/c/<slug>`**: landing por path en cualquier
  dominio, vestigios del flujo forms eliminados de `/c/`, OG unificado en
  `lib/campaign-og.ts`, spec `enlace-corto-qr` movida a `/s/{code}` por
  consistencia. Multidominio por Host intacto en `/`.
- Turnstile err 110200: hostname faltante en el widget — rectificado por el
  usuario en Cloudflare.
- Verificación de firma por email: `confirm_signature` idempotente + redirect
  302 a `/c/<slug>?confirmada=1|expirada` (antes JSON crudo) + banner en la
  landing + copy 24 h. `.env.example`: `RESEND_FROM_EMAIL` y `API_PUBLIC_URL`
  documentadas (faltaban — emails con remitente inválido y enlaces a localhost).
- Coherencia editor↔landing (4 bugs): `CampaignResponse` sin `asks`/
  `privacy_policy_id`/`org_id` (editor se hidrataba vacío; guardar habría
  borrado los asks), ruta de organizaciones equivocada (selector oculto),
  CTA con lime hardcodeado (tokenizado a `var(--bp)`), campo "logo de campaña"
  eliminado del editor (sin uso en la landing).

**Feature nueva `supresion-admin` (spec_ready):** supresión LOPDP desde el
dashboard de firmas; usuario eligió ventana de 15 días (archivar → email →
purga; reversible). La fila anonimizada sigue contando en la campaña.

**Contenido legal:** borradores de aviso al firmante (extenso + breve + label
del checkbox) y aviso a la organización para la política de la Plataforma por
la Soberanía Alimentaria.

**Estado al cierre:** TEST-6/7 ✓; TEST-5 casi (falta clic del email en prod con
`RESEND_FROM_EMAIL`/`API_PUBLIC_URL` en el VPS). 6 specs en spec_ready. Orden
fase 3: cifrado-reposo → retencion-datos → supresion-admin → derechos-arco.

**Próxima sesión:** aprobar specs → implementar `cifrado-reposo` (bloqueante
antes de recolectar firmas reales); completar TEST-5 en prod.

---

## 2026-07-06 — Sesión 22: editor-branding + UX landing + OG + bugs

**`editor-branding` completo:** `BrandingColorPicker.tsx` (presets Bosque/Océano/Fuego, color picker, hex, preview botón CTA con `autoOnPrimary()`). `CampanaEditorClient` con 3 secciones nuevas: Identidad visual (color primario + logo + welcome copy), Agradecimiento (thank_you_title/body), Redes sociales (6 URLs). Backend: `CampaignCreate` y `CampaignUpdate` extendidos con 12 campos; `_META_FIELDS` de 7 → 19. Campaña `prueba_001` creada con todos los campos llenos (ID: `6def46c9`).

**UX admin:** Botón "Guardar cambios" en barra sticky superior (`form="editor-form"`). "Ver firmas" diferenciado en color oscuro (`--bink`). Título editor: `font-heading` Work Sans Bold 22 px. Headers de sección: 12.5 px bold ink (antes 11 px muted). Labels: 12 px. Hints: 12.5 px visibles.

**Hydration fix (timezone):** `toLocaleDateString()` sin `timeZone` causaba mismatch servidor UTC vs cliente UTC-5. Fix `timeZone: "America/Guayaquil"` en 6 archivos del admin.

**Aviso de privacidad — modal inline:** enlace en StepForm ahora abre modal con overlay + X (fetch lazy desde API). Página `/aviso-de-privacidad` mantiene fix `overflow-wrap: break-word`.

**StepSuccess:** nombre del firmante en título, ícono SVG envelope limpio, aviso spam como pastilla con ícono ⓘ.

**StepThanks:** ícono ✓ → corazón SVG + animación `heartbeat` al montar. Logo WA SVG oficial. Instagram añadido. Newsletter separado con `borderTop` y tipografía más visible. Copy de compartir construido desde identidad visual (`welcome_title` + `welcome_slogan` + `share_text`) con CTA emoji y URL.

**Contador post-firma:** `get_total_signature_count()` (confirmed + pending_confirmation) → `total_count` en API pública. Frontend usa `total_count` para StepThanks; contador público sigue con solo confirmed.

**Open Graph:** `og:url/type/title/description/image` (1200×630), `twitter:card summary_large_image`, `fb:app_id` desde `NEXT_PUBLIC_FB_APP_ID`. Descripción usa `welcome_description` → `share_text` → fallback.

**Sesión 23 — fix difusión social:** emojis incompatibles con WhatsApp (`🌿` Unicode 7.0) reemplazados por texto plano. FB/IG removidos de StepThanks (restricción de plataforma: no admiten texto pre-relleno). Botón `navigator.share` nativo (móvil) + botón "Copiar texto" con clipboard API. Copy editable desde campo "Texto de difusión" en admin.

**Tamaño del proyecto al cierre de sesión 23:** ~21 500 líneas de código fuente (`.py` + `.ts` + `.tsx` + `.sql`, sin migraciones, specs ni historial).

---

## 2026-07-06 — Sesión 21: ciclo-vida-admin completo + layout admin segunda columna + infra-fork VPS confirmado

**`infra-fork` — estado VPS confirmado por el usuario:** Cloudflare (DNS, SSL Full strict, Always HTTPS, WAF, widget Turnstile) ✓. GitHub Secrets configurados ✓. Más de 2 deploys exitosos via CI/CD ✓. VPS: repo clonado, `.env` creado, contenedores running, migraciones aplicadas, nginx + certbot ✓. Admin de producción: confirmado (`javier@zamarrito.com` / admin / activo). TEST-5 en adelante pendientes (flujo de firma en prod, firma visible en admin). Paso 6 (campaña real): pendiente — primero deployar cambios locales de sesiones 20-21.

**`editor-branding` — specs actualizados y aprobados:** Corrección: funciones WelcomeConfigEditor y SocialLinksEditor ya existen en `/admin/campaigns/[id]/` (forms-qsm); el trabajo es portarlas al nuevo editor con design system Lime/Ink. El design system Claude Design sesión 19 es la base; solo se expone ajuste del color primario (`--bp`), no se rompe el sistema. Specs reducidos: 3 presets (Bosque/Océano/Fuego), 1 picker de color, copy fields, social links, sin Claude Design previo (extensión de pantalla existente). `.env.example` actualizado con `PLATFORM_ADMIN_EMAILS`.

## 2026-07-06 — Sesión 21: ciclo-vida-admin completo + layout admin segunda columna

**`ciclo-vida-admin` (Fase 2) — implementación completa:** specs SDD (requirements R1-R16, design.md, tasks.md) + backend (schemas, config, consent notify_updates, migration 014, email_service x3, campaign_service x3 funciones, 2 endpoints PATCH/POST) + frontend (admin-lifecycle-api.ts client-safe, LifecycleConfirmModal, LifecyclePanelAdmin, integración en CampanaEditorClient). Migración 014 aplicada. TypeScript: 0 errores.

**Bugs resueltos:** 500 `CheckViolationError` (stage names en lowercase sin tildes); build error `next/headers` en Client Component (separación admin-lifecycle-api); modal no cerraba en éxito/error (modalError state, error inline en modal, cierra al confirmar); historial mostraba nombre DB raw (ahora usa `STAGE_NAMES[stage_index]`).

**Layout:** segunda columna admin ampliada: editor campaña `300px→360px`, resumen admin `260px→320px`; padding PanelSection `p-4→p-5`. Email en dev: `RESEND_API_KEY` vacía → loguea en consola, no envía reales.

---

## 2026-07-06 — Sesión 20: editor unificado nueva/editar campaña + fix categorías

**Nueva campaña = editor completo:** `CampanaEditorClient` refactorizado para aceptar `campaign?: AdminCampaign | null`. Modo `isNew`: auto-slug desde el título, POST en submit, header "Nueva campaña", sidebar Borrador estático, sin paneles QR/ID/Zona de peligro. `nueva/page.tsx` convertida a server component que carga categorías, políticas y orgs igual que la página de edición. `CampaignCreate` en backend expandido con todos los campos opcionales de `CampaignUpdate`; `create_campaign` extrae campos meta antes de construir el modelo. 2 commits aplicados en `dev`.

**Fix categorías (4 bugs):** (1) nombre no se trimmeaba → espacios al final generaban slug idéntico y 409; (2) constraint único global incluía archivadas → imposible recrear categoría archivada; (3) slugs con tildes en datos existentes (`agua-y-páramos`); (4) mensaje de error genérico sin guía al usuario. Correcciones: validators `trim_name` en schema, mensaje 409 descriptivo, migración 013 (partial unique index `WHERE archived_at IS NULL` + limpieza de datos), frontend recarga lista en 409 y muestra mensaje específico. Commit 3 pendiente de ejecutar.

---

## 2026-07-05 — Sesión 19: rediseño completo design system v2 — landing + SignFlow + admin

**Design system v2:** fuentes Anton (display) + Work Sans (body) cargadas vía `next/font/google`. Tokens CSS actualizados: Lime `#D7F24C` como CTA/primary, Ink `#16261F`, Sage `#EDF4F1` como fondo, Green Light `#DCE9E6`. `category-color.ts` nueva utilidad. Tailwind: `font-display` → Anton, `font-body` → Work Sans.

**Landing pública (9 componentes reescritos):** `CampaignPage` con grid sidebar-primero DOM + order invertido desktop. `ActionBlock` chip full-width Ink, CTA Lime, dot pulsante cauce-live-dot. `PetitionBody` sección "Por qué importa" fondo Ink oscuro con heading Lime. `LifecycleSteps` horizontal con dot activo coloreado. `ShareSection` WA Ink Blue. Fondo sage `#EDF4F1`.

**SignFlow (6 archivos reescritos):** bottom-sheet mobile / modal desktop con blur. Pills activos Ink bg + sage text. `StepThanks` nuevo con contador crema + opt-in newsletter independiente.

**Admin (15 archivos):** sidebar item activo Lime+Ink. `ui/Button` primary Lime+Ink. `ui/Badge` active/collecting Lime+Ink. 40+ instancias `#18794A` reemplazadas por Green Light chips + Ink text. `text-white` sobre Lime corregido en 13 páginas. TypeScript: 0 errores. 4 commits borradores preparados.

---

## 2026-07-04 — Sesión 18: org detail, categorías inline, políticas inline + 9 rectificaciones front/back

**Batch 1 (ítems 8-10):** `/admin/organizaciones/[id]` (edit org + campañas vinculadas), `CategoriasList` inline edit + campañas lazy, `PoliticasList` inline edit + campañas lazy + modal contrato LOPDP.

**Batch 2 (9 rectificaciones):** CSP `img-src https:`, PetitionBody iconos MDI SVG + jerarquía asks numerados, StepThanks icono MDI + iconos en botones sociales, ShareSection prop `shareText`, CampanaEditorClient campo `share_text` + secciones movidas al panel derecho + validación preemptiva + banner error prominente, PoliticasList botón × SVG en modal, firmas/page.tsx reescrito como tabla de campañas con conteos, OrgDetailClient campo logo_url + miniatura, backend `share_text` en `CampaignUpdate`+`_META_FIELDS`+`_serialize`. TypeScript: 0 errores. Docker rebuild exitoso. 5 commits en branch `dev` (766309c…6f29113).

---

## 2026-07-03 — Sesión 17: cierre administrativo — borradores de commits + resumen ítems 8-10

**Completado:**
- Preparados 11 borradores de commits para sesiones 13-16 (sin código nuevo)
- Corregido error zsh glob en rutas con `[id]`: usar comillas simples
- Breve resumen de ítems 8-10 pendientes (perfiles-org): org detail page, edición inline categorías, edición inline políticas + template LOPDP

**Pendiente:**
- El usuario ejecuta los commits manualmente en terminal
- Review manual de los 5 puntos de sesión 16 (PetitionBody, ShareSection, StepThanks, editor layout, validación activación)
- Implementar ítems 8, 9, 10 de perfiles-org

---

## 2026-07-03 — Sesión 16: editor rework + ShareSection + StepThanks + PetitionBody

**Completado:**
- `PetitionBody.tsx`: headers "Lo que pedimos" / "Por qué importa" con icono + badge color; asks en bold/15px
- `ShareSection.tsx`: reescritura completa — iconos SVG, sin Telegram, +Email, QR bajo URL, archivos descargables, disabled cuando `closed`
- `StepThanks.tsx`: sin Telegram, agrega X + Facebook + Email, layout mejorado
- `CampanaEditorClient.tsx`: layout 2 columnas rework — portada (desktop+mobile URL), asks editor (max 5), archivos descargables, QR generator client-side, categoría/fecha/política movidas al panel derecho, selector de org
- Validación antes de activar: warning amarillo en panel + indicadores rojos por campo faltante; `api.ts` corregido para serializar `detail` objeto a JSON
- Correcciones: `AdminCampaign.asks`, `CategoriasList/OrganizacionesClient/PoliticasList` usan `api.post/patch`, `qr_code_data` en `CampaignUpdate`
- TypeScript: 0 errores; contenedor web compilando sin errores

**Pendiente:**
- Review manual de 5 puntos (PetitionBody visual, ShareSection, StepThanks, editor layout, validación activación)
- Ítems 8, 9, 10: org detail page, edición inline categorías, edición inline políticas + template contrato LOPDP

---

## 2026-07-02 — Sesión 12: dashboard-firmas implementado + ui-design-system verificado

**Completado:**
- `dashboard-firmas` — API + frontend completo (T1-T28):
  - `GET /v1/admin/campaigns/{id}/signatures` — lista paginada con filtros provincia/visibility/status
  - `GET /v1/admin/campaigns/{id}/signatures/export.csv` — export con filtros activos
  - Stats (confirmed/pending/anulada) siempre sobre totales de campaña, independientes de filtros
  - Frontend: FiltrosBar (form GET auto-submit), ExportCsvButton (window.open), tabla semántica, paginación URL-based
  - Verificado con Playwright: T19-T28 (tabla, badges, opacidad anuladas, filtros, export, breadcrumb, paginación)
- `ui-design-system` verificaciones V1/V3/V4:
  - V1: fidelidad visual — sidebar `#15241B`, tokens activos, layout fiel al handoff AdminPanel.dc.html
  - V3: 0 requests CDN; 86 @font-face via next/font (Poppins, Inter, Montserrat, Nunito, Fredoka)
  - V4: inyección tokens campaña — preset Océano propagado a toda la UI sin rebuild
- UUID de campaña dev corregido: `90160ea0-8f05-4605-9fb5-e1af8cc5bf52`
- Migración 010 (`country` en signatures) aplicada en Mac local

**Diagnóstico:** Los cambios del otro Mac no se reflejaban porque la migración 010 estaba en código pero no aplicada en la DB de este Mac. Solución: `docker exec petition-api-dev alembic upgrade head`.

**Pendiente:** `dashboard-firmas` pendiente validación final del usuario + `infra-fork` VPS + `resumen-admin` KPIs reales

---

## 2026-07-01 — Sesión 11: iteraciones formulario-firma + integración Resend

**Completado:**
- `form_config` en `campaigns.meta`: controla `signer_types`, `location_modes`, `required_fields`, `visibility_options` por campaña
- Migración 010: columna `country` en `signatures`
- Toggle persona natural/organización + campo `org_name`
- Toggle "¿Firmas desde?" Ecuador/Internacional: cédula con módulo-10 solo para nacional; internacional acepta cualquier identificación (opcional)
- Cédula movida al final del formulario (después de provincia/país)
- Visibilidad "Secreta" oculta por defecto; habilitada explícitamente en `form_config` de la campaña dev
- `email_service.py`: Resend (si `RESEND_API_KEY` configurado) o log en consola (dev)
- `POST /{campaign_id}/signatures/resend-confirmation` rate-limit 3/min, 204 siempre
- `StepSuccess` con estados idle/sending/sent en botón reenvío
- Step 4 obtiene contador real via `getCampaignCount()` antes de mostrar
- Specs `dashboard-firmas` generados: requirements.md + design.md + tasks.md (T1-T28)
- Flujo completo verificado: submit ✓ | email log ✓ | resend 204 ✓ | confirm ✓ | Step 4 con contador real ✓

**Pendiente:** `dashboard-firmas` implementación + `infra-fork` VPS + activar `RESEND_API_KEY` en producción

---

## 2026-07-01 — Sesión 10: contingencia git + verificación MVP en Mac casa

**Completado:**
- Diagnóstico y resolución de historias git divergidas entre Mac casa y Mac oficina
- Alias SSH corregido en remote URL (`githubqsmlab` → `github-qsmlab`)
- `git reset --hard origin/dev` — Mac casa sincronizada con Fase 1 completa del remoto
- Contenedor API reconstruido (`jinja2` faltaba en imagen anterior)
- Migraciones 006–009 aplicadas en DB local de Mac casa
- Seed ejecutado: org, admin, contrato, campaña, privacy_config, lifecycle_events
- MVP Fase 1 verificado en browser: landing ✓ | Sign Flow ✓ | admin ✓

**Aprendizaje registrado:** Siempre `git pull --rebase origin dev` al iniciar sesión. Nunca usar disco externo para transferir código — usar `git bundle` sin internet. En Mac nueva: `make migrate` + `make seed` + reconstruir contenedor si cambiaron dependencias.

**Pendiente:** `dashboard-firmas` (siguiente feature) + `infra-fork` VPS

---

## 2026-06-30 — Sesión 9: Fase 1 MVP funcionando end-to-end

**Completado:**
- Specs generados y aprobados: `multidominio`, `anti-fraude-basico`, `landing-campana`, `formulario-firma`
- API Fase 1: `domains.py` (resolve-domain), `public_campaign.py` (by-slug, GET/POST signatures, confirm), schemas, domain_service, signature_service
- Next.js Fase 1: `page.tsx` Server Component con resolución slug/dominio, `aviso-de-privacidad/page.tsx`, middleware actualizado, CampaignPage (layout 1col/2col), 8 subcomponentes, SignFlow (5 estados, bottom sheet/modal)
- 5 bugs corregidos: campaign status draft→active en seed; alias red `petition-api` en docker-compose; turnstile bypass usa prefijo; migración 008 RLS `sig_org_admin` con NULLIF; migración 009 UPDATE policy para confirm flow; `confirmada`→`confirmed` en signature_service
- Flujo completo verificado: GET landing ✓ | POST signature 201 ✓ | GET confirm 200 `{count:1,goal:10000}` ✓ | dedup 409 ✓ | cédula inválida 422 ✓

**Pendiente:** commit de Fase 1 (~30 archivos) + commits modelo-base + lopdp-base; dashboard-firmas; infra-fork VPS

---

## 2026-06-30 — Sesión 8: lopdp-base implementado completo

**Completado:**
- Feature `lopdp-base` completa (T1–T18): migración 007 aplicada, templates Jinja2, render functions, runbook brechas
- `privacy_config.version` (SmallInteger) añadido vía migración 007
- 3 templates Jinja2: aviso de privacidad (9 secciones), contrato encargo (12 cláusulas), RAT (10 secciones + versiones activas)
- Render functions: `render_aviso_privacidad()` + `build_aviso_context()`, `render_contrato_encargo()` + `build_contrato_context()` + `get_contrato_dev()`, `render_rat()` + `build_rat_context()`
- Runbook brechas `docs/legal/runbook_brechas.md`: cronograma T+0→T+72h, árbol decisión, contenido SPDP, registro interno
- `seed_dev.py` usa `get_contrato_dev()` y `render_aviso_privacidad(build_aviso_context(...))` — texto real completo en BD
- `.env.example` + `config.py`: vars `ENCARGADO_*` y `RESEND_API_KEY`
- Todos los templates son condicionales natural/juridica para Responsable y Encargado (Cauce Petition opera como persona natural hasta SAS)
- `make migrate` → 007 aplicada ✓ | `make seed` → exitoso ✓

**Pendiente:** commit de ~15 archivos (modelo-base) + ~14 archivos (lopdp-base) + progress

---

## 2026-06-30 — Sesión 7: modelo-base implementado + configuración Mac 2

**Completado:**
- Configuración Mac 2: SSH alias `githubqsmlab`, clave `github_mac_ae` (ed25519, sin passphrase), Docker + Node instalados
- Push de archivos pendientes desde Mac 2, clone limpio en `~/Dev/proy_petition-cauce/`
- Feature `modelo-base` completa (T1–T18): migración 006 aplicada y verificada en dev

**Detalle migración 006:**
- 6 tablas nuevas: `processing_contracts`, `signatures`, `consents`, `privacy_config`, `lifecycle_events`, `domains`
- 3 tablas extendidas: `users` (status, archived_*), `organizations` (domain, rep_name, status, archived_*), `campaigns` (processing_contract_id, signer_type, campos petición, lifecycle_stage, archived_*)
- Trigger inmutabilidad contratos firmados (`signed_at IS NOT NULL`)
- RLS en `signatures` y `consents` (política admin por org_id + política pública)
- 4 índices únicos parciales en `signatures` para deduplicación por tipo de firmante
- `crypto.py`: `hmac_sha256(value, key)` + `verify_cedula()` módulo-10 Ecuador
- `seed_dev.py`: CONTRATO-DEV-001 (firmado) + campana-dev-001 (signer_type=both, lifecycle_stage=1) + privacy_config + 2 lifecycle_events

**Bugs resueltos:**
- Índice `idx_consents_campaign` duplicado con migración 001 → renombrado
- `AmbiguousForeignKeysError` en `Organization.users` por múltiples FK → `foreign_keys="User.org_id"`
- Seed bloqueado por RLS en campaigns → `SET LOCAL app.current_org_id` antes del INSERT

**Pendiente:** commit de 13 archivos + progress (el usuario lo ejecuta manualmente)

---

## 2026-06-29 — Sesión 6: Admin shell + spec modelo-base aprobado

**Completado:**
- Incorporado handoff `design_handoff_cauce_back-admin/README.md` al proyecto
- Nuevo `AdminSidebarClient.tsx`: sidebar 220px, bg `--bink`, 6 nav items, RBAC por rol, iconos SVG, logout
- Nuevo `layout.tsx` del admin: server component, fetch user, filtra nav según `role: admin|gestor`
- 6 nuevas rutas: `/admin/resumen`, `/admin/campanas`, `/admin/firmas`, `/admin/organizaciones`, `/admin/usuarios`, `/admin/configuracion`
- Redirigidos `/admin/dashboard` y login post-auth a `/admin/resumen`
- RBAC: gestores ven solo Campañas y Firmas; admin ve todo; páginas admin-only redirigen a /campanas si gestor accede
- Todos los stubs con design shells completos (badges, tablas, filtros, toggles) según spec del README
- `User.role` extendido con `"gestor"`
- TypeScript: 0 errores

**También completado:**
- Spec `modelo-base` generado, revisado con 5 decisiones clave y aprobado (spec_ready)
- 4 commits realizados: harness, infra, ui-design-system, admin shell

**Pendiente próxima sesión:**
- Implementar `006_modelo_base.py` + modelos SQLAlchemy (T1–T18 en specs/modelo-base/tasks.md)

---

## 2026-06-27 — Sesión de apertura: planificación y andamiaje Harness SDD

**Completado:**
- Plan de desarrollo leído y validado (PLAN_VALIDACION_campanas_firmas.md y PROJECT_REFERENCE.md)
- Plan aprobado: fork independiente de forms-qsm, rol LOPDP Encargado, MVP urgente (campaña real)
- Andamiaje Harness SDD completo: CLAUDE.md, AGENTS.md, WORKFLOW_LOCAL.md, PROJECT_REFERENCE.md, SECURITY_OVERVIEW.md, .gitignore, feature_list.json (24 features, Fases 0–5), progress/

**Rectificaciones aplicadas:**
- Nombre correcto del directorio local: `proy_petition-cauce/` (con c)
- `multidominio` movido de Fase 2 a Fase 1 — arquitectura correcta desde el primer deploy
- Pasos de pre-configuración Cloudflare documentados en WORKFLOW_LOCAL.md §5
- `harness-setup` marcado como `done` en feature_list.json

**Decisiones de infra confirmadas:**
- Repo: `https://github.com/qsm-lab/petition-cauce.git`
- Dominio MVP: `cauce.ecuadornotlc.org` (Cloudflare Free, 1 regla WAF)
- Multi-dominio: en Fase 1, no en Fase 2

**Próxima sesión:** Fase 0 — `infra-fork`, `modelo-base`, `lopdp-base`.

---

## 2026-06-28 — Sesión 2: confirmaciones de arquitectura + spec infra-fork

**Confirmaciones validadas:**
- DB y Redis: contenedores propios por proyecto (no compartidos con forms-qsm)
- Deploy incremental: Docker layer cache; solo reconstruye lo modificado
- Frontend: flujo Claude Design (Adobe Express) → HTML exportado → Next.js/Tailwind
- `ui-design-system` agregado como feature Fase 0
- Ambos proyectos completamente independientes y operables por separado

**Spec generada:** `specs/infra-fork/` (requirements.md R1–R16, design.md, tasks.md) — pendiente aprobación.

**Pendiente:** aprobación de spec `infra-fork` → implementación.

---

## 2026-06-28 — Sesión 3: implementación infra-fork (bloques B–E) + reglas de secretos

**Completado — archivos generados (infra-fork bloques B–E):**

| Archivo | Contenido |
|---------|-----------|
| `docker-compose.yml` | 4 servicios propios: petition-api/web/db/redis, puertos 8011/3002 |
| `docker-compose.dev.yml` | dev con bind mounts, puertos 5435/6381 (sin colisión con forms-qsm) |
| `database/init.sql` | `petition_app` como NO superusuario → RLS activo en dev desde día 1 |
| `.env.example` | Separación explícita admin vs app; reglas de seguridad de secretos |
| `Makefile` | 14 targets: dev, migrate, test, db, db-app, check-isolation, etc. |
| `infra/nginx/cauce.ecuadornotlc.org.conf` | TLS, CF real IP, proxy 8011/3002, `Host $host` en ambos locations |
| `.github/workflows/deploy.yml` | 20m timeout, sin --no-cache, VPS_SSH_KEY + DEPLOY_PATH |
| `apps/api/app/config.py` | Adaptado: petition-api, 3002, default_org_slug=cauce, URLs separadas admin/app |
| `apps/api/alembic.ini` | Documenta uso de DATABASE_URL_SYNC para migraciones |
| `apps/web/next.config.mjs` | CSP 8011 en dev, allowedOrigins cauce.ecuadornotlc.org |
| `WORKFLOW_LOCAL.md §4` | Secrets GitHub (4 vars), certbot, comando nginx vhost |

**Diferencia de seguridad clave vs forms-qsm:**
- `petition_app` es NO superusuario → RLS testeable en dev (forms-qsm no lo tenía)
- `DATABASE_URL` (app) separado de `DATABASE_URL_SYNC` (admin para Alembic)

**Reglas de secretos añadidas a memoria:**
- Secretos del `.env` siempre se agregan manualmente; Claude nunca escribe valores reales
- Secretos de producción deben ser diferentes a los de desarrollo y generarse manualmente
- En local/dev: Turnstile usa claves de test oficiales de Cloudflare (`1x00000000000000000000AA`)

**Pendiente (requiere acción manual del usuario):**
- A1–A4: `git init`, branches dev/main, remote origin
- COPY: `cp -r ~/Devs/proy_forms-qsm/apps .`
- Crear `.env.dev` desde `.env.example` con valores reales de dev (Turnstile test keys)
- C4/C5: adaptar `config.ts` y seeds después del COPY
- F1–F8: verificación completa con `make dev`

**Próxima sesión:** Verificación F1–F8 post-git/COPY + inicio `ui-design-system` (Fase 0).

---

## 2026-06-28 — Sesión 4: verificación F1–F7 + bloques C4/C5 infra-fork

**Completado:**

- Git inicializado (`git init`, rama `dev`, remote `git@github-qsmlab:qsm-lab/petition-cauce.git` — alias SSH correcto para cuenta org)
- COPY apps/ completado desde forms-qsm (sin sobreescribir los 3 archivos ya adaptados)
- `.env.dev` creado con secretos de dev y Turnstile test keys
- `make dev` levanta los 4 contenedores correctamente
- Verificación F1–F7 completada: todos los checks pasan
  - F4: `{"status":"ok","db":"ok","redis":"ok","version":"1.0.0"}`
  - F6: `petition_app` no superusuario, `rolbypassrls=f`
  - F7: corregida redacción de la spec (schema=public, no schema petition_cause — la BD se llama petition_cause)
- C4: `api.ts`, `api-server.ts`, `ExportButtons.tsx` — fallbacks 8010→8011, container forms-api-dev→petition-api-dev
- C5: todos los scripts seed Python y migración 004_rls — sin referencias a forms-qsm

**Pendiente de infra-fork (no bloquea desarrollo):**
- D3 + F8 + Cloudflare + GitHub Secrets — se hacen antes del primer deploy a VPS

**Próxima sesión:** Feature `ui-design-system` (spec SDD → diseño Claude Design → Next.js/Tailwind).

---

## 2026-06-29 — Sesión 5: ui-design-system (implementación) + acceso admin operativo

**Completado:**

**Sistema de diseño base (ui-design-system):**
- Tokens CSS (custom properties `--bp`, `--bop`, `--bsec`, `--bink`, `--bmut`, `--bsurf`, `--bbg`, `--bbord`, `--br`) con tema Bosque por defecto
- `@layer utilities` en `globals.css` — 15 clases semánticas que responden a sobreescrituras de tokens por campaña
- Fuentes: Poppins (display) + Inter (body) via `next/font/google` (build-time, sin CDN en runtime)
- Componentes: `Button`, `Card`, `Badge`, `FormField`, `Alert`, `cn()`, `design-tokens.ts` (3 presets + `campaignStyleTag()`)
- Login page completamente rediseñada con identidad "Cauce Petition" y toggle show/hide password

**Bugs críticos resueltos (acceso admin):**

| Bug | Causa raíz | Fix aplicado |
|-----|-----------|-------------|
| Migraciones no aplicadas | Alembic nunca ejecutado en este entorno | `alembic upgrade head` (5 migraciones) |
| Email de seed rechazado | `.local` TLD reservado, pydantic 422 | `admin@cauce.local` → `admin@cauce.ec` |
| JavaScript bloqueado | CSP sin `'unsafe-eval'`; Next.js dev lo requiere | Agregado a `script-src` en `next.config.mjs` |
| Cookie rechazado por browser | `secure=True` con HTTP en dev | `secure=settings.environment == "production"` en `auth.py` |

**Admin accesible y verificado al cierre de sesión.**

**Lección técnica registrada:**
- Tailwind v3 no genera utilidades para colores definidos como `var(--css-var)` — usar `@layer utilities` en CSS
- `next.config.mjs` se copia en la imagen Docker en build; requiere `--build` para actualizar (no es volumen)

**Pendiente (no bloquea):**
- V1/V3/V4 verificación visual del design system
- Commit de todos los archivos pendientes (revisar lista en `progress/current.md`)
- Infra VPS: D3/F8/Cloudflare/GitHub Secrets — antes del primer deploy

**Próxima sesión:** Verificaciones V1/V3/V4 + commit, luego `modelo-base` o `landing-campana`.

---

## Sesión 26 — 2026-07-08

**Foco:** UI de la landing pública (desktop + móvil, iterado con capturas), marca +Cauces.org, OrgCard expandible, fix filtro provincia (T26).

**Commits (usuario):** `7c9ef37` fix provincias · `9020748` asks A-E · `3bf8a0c` OrgCard expandible + API org · `810ba42` rediseño landing.

**Entregado:**
- Tarjeta de firma "viajera" en desktop: compresión a solo botón + intercambio de lugares con org/compartir (FLIP 700/600ms, easeOutCubic; sticky en última posición; histéresis en scroll up; expande solo al volver al primer lugar). Fueron 3 iteraciones: sticky+z-overlay → sticky-bottom al final del sidebar → intercambio de lugares (definitiva, sin sobreposiciones).
- Hero: eslogan `welcome_slogan` con loop 9s y color por luminancia real (canvas); "Impulsada por"+logo org abajo-derecha (desktop); tag categoría arriba-derecha (invertido ink/categoryColor en móvil); portada móvil full-bleed.
- Compartir: botones circulares solo-icono (FB/X/Email/Copiar) ambos breakpoints; URL solo móvil; QR intacto; docs destacados en desktop.
- Marca "+Cauces.org" (Poppins + / Anton) en nav landing (atenuada, −15%) y sidebar admin; footer oscuro "sin fines de lucro hecha en Ecuador".
- OrgCard expandible (descripción + contact_email); serializer público expone datos institucionales de la org (no PII).
- "Lo que pedimos" con letras A–E (landing + editor); riel de etapas centrado/simétrico (fix flex de última etapa).
- Fix T26: filtro provincia admin con 6 provincias hardcodeadas → `lib/provincias.ts` (24+Otra) compartida con StepForm. T25/T27 validados por usuario; T28 pendiente.

**Verificación:** 57 tests API · tsc 0 · validación visual del usuario en dev con capturas.

**Deploy:** sin migraciones ni env nuevas; falta `welcome_slogan` en campaña TLC de prod para que aparezca el eslogan.

**Lección técnica:** para reordenar elementos animados con Tailwind `order` + FLIP, capturar los `getBoundingClientRect().top` en el scroll handler ANTES del `setState` y aplicar el inverso en `useLayoutEffect`; el trigger de visibilidad debe observar el botón, no la tarjeta contenedora (pantallas 13-14").

---

## Sesión 27 — 2026-07-08

**Foco:** ajustes UX landing/formulario (con capturas), LOPDP en emails, export CSV enmascarado, popup post-confirmación, 2 fixes RLS, spec `export-entrega`.

**Entregado:**
- **Fix RLS doble**: el aviso de privacidad público devolvía 404 (política de la org plataforma invisible bajo el contexto de la org de la campaña) y el mismo patrón dejaba el snapshot del consentimiento vacío en `create_signature` — bypass transaction-local puntual por FK en ambos.
- Formulario: firma **pública por defecto**, textos por visibilidad bajo los pills (cambian con la selección), pills azul #2B4EEA tras interacción (default negro), usted en lugar de vos, borde ink en CTAs lime, icono mano firmando al hover, título con interlineado 1.14, icono edificio gubernamental en "Dirigida a".
- Móvil: "Por qué importa" full-bleed; CTA flotante con fondo azul y entrada/salida animada.
- Emails: footer transparencia +Cauces.org en todas las plantillas; confirmación con nota de la visibilidad elegida + enlace al aviso + mailto de la org para cambios posteriores; **segundo email de agradecimiento** al confirmar (botones WA/FB/X + QR si visible); redirect con `&nombre=` → **popup de compartir** en la landing.
- Admin: 3 eslóganes rotativos (meta, sin migración) en el hero; export CSV con `cedula_parcial`/`email_parcial` (17XXXXX601 / jguXXXXXXX@gmail.com); fix compartir sin URL + limpieza de U+FFFD.
- SDD: análisis de descarga completa de PII aprobado → feature `export-entrega` (fase 3, spec_ready) con requirements/design/tasks — step-up auth (password + OTP email), token single-use, secretas excluidas, auditoría `pii_export_audit`, notificación al Responsable.

**Verificación:** 57 tests API · tsc 0 · smoke tests curl (privacy 200, landing 200, popup con nombre, CSV enmascarado end-to-end). **Pendiente probar en producción.**

**Deploy:** sin migraciones ni env nuevas — solo `git push`.

**Lección técnica:** las tablas con RLS por org rompen silenciosamente los endpoints públicos y los flujos cross-org (Encargado↔Responsable); toda lectura pública por FK directa necesita contexto RLS explícito. `onAnimationIteration` permite rotar contenido de una animación CSS infinita justo cuando está oculta.

---

## 2026-07-13 — Sesión 31: dashboard de firmas, 2 fixes de RLS, y remediación real de 247 firmas

**Foco:** pedido puntual de la campaña real activa — rama `fix/dashboard-firmas-entrega` partida de `origin/main` (no de `dev`, que sigue congelado con retención/supresión/ARCO sin mergear). PR #9 mergeado y desplegado a producción durante la sesión.

**Entregado:**
- **Dashboard de firmas** (3 puntos pedidos): "Descarga absoluta" (contraseña sin OTP, excluye siempre `secreta`, notifica a org+plataforma, auditoría `pii_export_audit`); nombre visible según rol (`gestor` no ve `secreta`, `admin` sí); columna Nombre con formato `(org) nombre`; columna Provincia → Origen (color por provincia/país, filtro Internacional); extra: botón "Recordar a pendientes" (reenvía confirmación a `publica`+`pending_confirmation`).
- **Fix RLS `consents_org_admin`**: mismo bug de `sig_org_admin` pre-migración-008 (falta `NULLIF` antes del cast a uuid), nunca portado a `consents` — causaba errores intermitentes al crear firmas. Migración 031.
- **Fix RLS confirmación de `secreta`**: daba 500 siempre — ninguna política le daba visibilidad a la fila `confirmed`+`secreta` resultante, ni al propio firmante. Bypass transaccional `app.is_platform_admin`.
- **El nombre se guarda siempre** (antes solo si `visibility='publica'`): el formulario le promete al anónimo que su firma va al documento de entrega — imposible sin el nombre. Hallazgo colateral: el email de confirmación ya mostraba el primer nombre en anónimas (usaba `data.name` crudo, no el `sig.name` nuleado) — confirmado con un payload real de Resend; techo de recuperación: solo primer nombre, nunca el completo.
- **Remediación del histórico** (migración 032): script CLI `send_name_completion_emails` (`--dry-run`/`--force`) + popup en la landing (`?completar=token`, 7 días) que completa el nombre y promueve `pending_confirmation` → `confirmed` en el mismo paso. Excluye `secreta` (su firma nunca va al documento de entrega) y `anulada`. **Corrida real contra `soberania-tlc-ecu-usa`: 247/247 enviados** (239 anónimas + 8 públicas con nombre incompleto, 0 secretas, verificado sin contaminación de `is_test`).
- **Infra de email** (fuera de código, en Cloudflare/VPS): revisión de 4 alertas de deliverability de Resend, **3 resueltas por el usuario en la misma sesión**. `database/init.sh` sin permiso de ejecución corregido (bloqueaba cualquier volumen nuevo de DB dev). Mailto con dominio equivocado → Cloudflare Email Routing (`info@ecuadornotlc.org` → buzón real en GreenGeeks `info@ecuadornotlc.com`), regla de ruteo creada y verificada, `contact_email` de la org actualizado. Registro DMARC cargado en Cloudflare DNS. `RESEND_FROM_EMAIL` cambiado de `noreply@` a dirección real, confirmado funcionando. (La cuarta alerta, el link `wa.me` del botón de WhatsApp, es un falso positivo inherente a cualquier botón de compartir — no accionable.)

**Verificación:** 65 tests API (8 nuevos de masking) · `tsc --noEmit` 0 · flujo completo probado en dev con datos simulados (secreta/anónima/pública/org, distintas provincias/países) antes de tocar producción. DB dev reseteada para poder correr las migraciones de esta rama (partía de `main`, sin la cadena 018-022 de `dev`).

**Deploy:** 3 commits → PR #9 → merge a `main` → `docker compose up -d --build petition-api` (migraciones 030-032 vía pipeline de `deploy.yml`). `main` local estaba desactualizado desde "sesión 20" (sin relación de ancestro con `origin/main`); resuelto con `git reset --hard origin/main` sin pérdida de trabajo.

**Nota de reconciliación futura:** las migraciones 030-032 parten de la 017 (head de `main`), no de la cadena 018-022 de `dev` — al mergear `dev` a `main` van a aparecer dos heads de Alembic que van a requerir `alembic merge` explícito. Mismo tema para los `progress/*.md` de `dev` (siguen en sesión 30).

**Lección técnica:** en RLS, un `SET LOCAL` transaccional (`is_local=true`) sobre un GUC custom nunca antes tocado en la sesión crea un placeholder cuyo valor de reset es cadena vacía (`''`), no `NULL` — cualquier policy con `current_setting(...) != ''` sin `NULLIF` puede reventar en una conexión pooleada reutilizada después de esa transacción, aunque la lógica parezca correcta en aislamiento. Para UPDATE bajo RLS, el estado resultante de la fila también necesita una política que otorgue visibilidad de lectura — no alcanza con que el `WITH CHECK` pase.
