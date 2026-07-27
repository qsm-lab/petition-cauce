# Tasks — centro-comunicaciones

> No implementar hasta que el usuario apruebe esta spec (sdd:true) y **exista
> diseño Claude Design aprobado** (`design-export.html`) — feature frontend.
> Implementación por fases; cada fase es entregable/verificable por separado.

## Puntos abiertos — estado (sesión 37)

- ✅ **Consolidación aprobada**: `comunicaciones-cierre-campana` y
  `programacion-historial-comunicaciones` marcadas superseded en feature_list.
- ✅ **Orden Alembic**: **039+** (tras 036 embudo, 037 fix-RLS-arco, 038 config-email); ver
  `config-email-org` §Dependencias. Sus tablas (cola/upload) llegan en Fase 3.
- ✅ **Montaje del volumen**: **Opción A** (FastAPI `/media` + cache inmutable)
  para MVP, sin tocar nginx; opción B (nginx) queda como mejora futura con tu OK.
- ✅ **Contador de cuota**: por credencial vía `config-email-org`, con los headers
  `x-resend-daily/monthly-quota` como fuente de verdad de Resend (R21).
- ✅ **Dependencia `email-cumplimiento-masivo`**: la clase *Anuncios* se habilita
  en producción solo con footer + desuscripción funcional.
- ✅ **Diseño del frame**: `design-export.html` creado y **aprobado por el
  usuario** (sesión 37). Spec aprobada — lista para `in_progress`.

## Fase 1 — Frame + editor + segmentación + envío inmediato

### Backend — HECHO (sesión 38)
- [x] Campos **cosméticos** de remitente en `campaigns`: `sender_from`,
  `sender_reply_to`, `sender_display_name` — ya existían desde `config-email-org`
  sesión 37 (proveedor/plan/credenciales van ahí) (R16).
- [x] Envío vía `resolve_sender`/`transport_from_config`/`platform_transport` de
  `config-email-org` (`_resolve_campaign_email_context` en `campaigns.py`); el
  centro no maneja credenciales propias (R16, R17). Cuota contada por
  credencial vía `email_quota` (mismo mecanismo de `config-email-org`).
- [x] `comms_service.py`: `sanitize_comms_html` (`nh3`, allowlist +
  `img@src` restringido al dominio de uploads — aunque el upload en sí es
  Fase 2); `build_segment_filters`/`count_recipients`/`get_recipients`
  (R8–R11, clase fuerza el universo antes de la segmentación, impuesto en
  backend independientemente de lo que mande el cliente); `build_comms_email_html`
  (plantilla + CTA(s) editables con normalización de URL + toggle de redes,
  reusando `_social_icon_links`/`_powered_by_block`/`_PLATFORM_FOOTER_HTML` de
  `email_service.py`).
- [x] Endpoints en `campaigns.py`: `POST .../comms/recipients/count`,
  `.../comms/preview`, `.../comms/send` (test/real, `@limiter.limit("5/minute")`
  en el envío real) — JWT+rol+scope (mismo patrón que `lifecycle/*`) (R2, R7, R10).
- [x] Tests (`test_comms_segmentation.py`, 13 passed): sanitización (script/
  atributos peligrosos/img externa eliminados, tags permitidos preservados);
  segmentación por clase (anuncios exige notify_updates+confirmed+no-archivada;
  servicio exige confirmed sin exigir consentimiento, Fase 1 sin tipo
  "recordatorio" así que pending_confirmation queda fuera para los 3 tipos);
  secretas nunca cuentan (ni aunque se pidan explícitamente); filtros de
  tipo/ubicación/visibilidad; CTA(s) + toggle de redes en el HTML armado.
  Verificado también con HTTP real (conteo, preview, tipo inválido → 400).
  Suite completa: 190 passed.
- [ ] Nota pendiente para Fase 3: el "recordatorio de confirmación" (única vía
  para que `pending_confirmation` reciba algo, R11) no es uno de los 3 tipos
  de Fase 1 — evaluar si se agrega como 4º tipo o se deja como la feature
  separada "Recordar a pendientes" que ya existe en dashboard-firmas.

### Frontend — HECHO (sesión 40)
- [x] Página `/admin/campanas/[id]/comunicaciones` + cliente (R1). Entrada de
  navegación nueva en `CampanaEditorClient.tsx` (card "Comunicaciones").
- [x] Editor WYSIWYG con toolbar (R3) + vista Código: se reutilizó
  `RichTextEditor.tsx` (compartido con el editor de campaña) y se le agregó
  soporte de enlaces (`@tiptap/extension-link`, no estaba antes). Toggle
  Visual/Código con remount controlado (`key`) al volver a Visual para no
  perder ediciones hechas en Código.
- [x] Bloques del email: CTA(s) editable(s) (agregar/quitar, toggle maestro)
  con preview del pill + toggle redes sociales (R5b, R5c).
- [x] Panel de audiencia con **checkboxes** + conteo en vivo (debounce 300ms)
  + badge de cuota (R8, R10, R21). Guard: no se puede desmarcar el último
  checkbox marcado de un grupo (evita que "grupo vacío" se interprete como
  "sin restricción" en el backend). "Pendientes de confirmar" y "Secreta"
  quedan deshabilitados con nota explicativa (Fase 1 no los soporta).
- [x] Preview real + envío de prueba + enviar ahora (R7), con modal de
  confirmación antes del envío real (destinatarios, clase, aviso si excede
  cuota).
- [x] Autosave local del borrador (`useDraft`) + acción "Volver al admin de
  campaña" (R22 parcial — server-side en Fase 3; R23). Sin botón explícito
  "Guardar borrador" (el diseño lo sugiere pero implica persistencia
  server-side que es Fase 3; se documenta en progress).
- [x] `comms-api.ts`.
- [x] **Backend nuevo no previsto en el diseño original**: `GET
  .../comms/quota` — el endpoint de cuota existente
  (`GET /organizaciones/{id}/email-config`) es `platform_admin`-only, pero
  R21 pide que "el admin del centro" (que puede ser `gestor`, no solo
  `admin`) vea la cuota. Se agregó un endpoint de solo lectura con scope de
  campaña, sin exponer credenciales.
- [x] Mantener el popup `AdherentCommsModal` operativo — **no se retira
  todavía**: tiene campos estructurados (fecha/lugar/mapa de la invitación,
  conteo final del cierre) que el nuevo frame no reconstruye (Fase 1 del
  centro simplificó los 3 tipos a un contenido genérico). Retirarlo implicaría
  perder esos campos — decisión pendiente del usuario.
- [ ] Test HTTP del nuevo endpoint `GET .../comms/quota` — verificado manual
  con curl (valores correctos contra datos reales), pero sin test automatizado
  todavía; el resto de tests de `comms` son a nivel de servicio, no HTTP, y no
  hay fixture de cliente HTTP en uso en el proyecto para replicar el patrón.

### Dependencia de shell (R24)
- [ ] Sidebar contraíble → **feature separada `admin-sidebar-colapsable`**
  (specs propias). El centro la consume; no se implementa aquí.

## Fase 2 — Storage de imágenes — HECHO (sesión 40)

- [x] Volumen de uploads (docker-compose) + config (ruta, tamaño máx).
  `settings.uploads_dir=/data/uploads`, `settings.comms_upload_max_bytes=25MB`.
  Bind mount dev (`./apps/api/data/uploads`, gitignorado) + named volume prod
  (`petition_uploads_data`). ⚠️ Pendiente coordinar con el usuario: nginx tiene
  `client_max_body_size 10M` en `location /api/`
  (`infra/nginx/cauce.ecuadornotlc.org.conf`) — bloquearía uploads reales
  cercanos a 25 MB en producción hasta subirlo a 25M (no tocado, regla del
  proyecto de no modificar nginx sin pedido explícito).
- [x] Modelo `comms_upload` + migración **039** con RLS (R18) — mismo patrón
  NULLIF que 038.
- [x] `POST /{campaign_id}/comms/uploads`: sniff de imagen **por firma de
  bytes** (jpg/png/gif/webp; SVG y cualquier otro tipo no matchea ninguna
  firma → rechazado) en vez de `python-magic`/libmagic — sin dependencias
  nuevas, evitando la instalación de paquetes de sistema con el contenedor sin
  salida a internet. ≤25 MB, nombre uuid, rate limit `20/minute` (R4, R19).
- [x] `GET /media/{org_id}/{campaign_id}/{filename}` — Opción A del design.md
  (FastAPI sirve el volumen, sin tocar nginx), público sin auth (las imágenes
  se embeben en emails), cache `immutable`, filename validado contra el patrón
  exacto de `save_comms_upload` (evita path traversal).
- [x] Editor: botón "🖼 Añadir medios" (modal drag&drop) inserta la imagen
  subida por URL vía `RichTextEditorHandle.insertImage` (ref imperativo,
  `@tiptap/extension-image` nuevo, gated por `allowImages` — nunca activado en
  el editor de campaña). `img@src` restringido al dominio de uploads (R6) —
  se corrigió `_uploads_origin()` para usar `settings.api_public_url` (con el
  prefijo `/api` que nginx ya proxea) en vez de `next_public_app_url`, que
  apuntaba al origen equivocado (el frontend, no quien sirve las imágenes).
- [x] Tests (`test_comms_upload.py`, 11 nuevos): sniff por firma (jpg/png/
  gif/webp válidos, SVG y texto plano rechazados, extensión disfrazada no
  engaña), rechazo de tamaño excesivo, guardado correcto en disco+DB, y
  **aislamiento RLS entre organizaciones** (sesión scoped a la org A nunca ve
  uploads de la org B). Suite completa: 201 passed.
- **Bugs reales encontrados y corregidos en la verificación** (no solo en la
  cabeza): (1) el contenedor de la API había perdido `nh3` al recrearse para
  aplicar el volumen nuevo — el fix manual de sesión 39 vivía en la capa
  efímera del contenedor viejo, no en la imagen; se reinstaló bajando el wheel
  en el host (que sí tiene red) y copiándolo al contenedor, mismo patrón que
  sesión 39. (2) CSP `img-src` en `next.config.mjs` no tenía la excepción
  dev-only para `http://localhost:8011` que `connect-src` ya tenía → las
  imágenes no se renderizaban visualmente en dev (bloqueadas por CSP, aunque
  el HTML y el backend estaban bien). Verificado con Playwright real
  (`naturalWidth` del pixel, no solo presencia del `<img>`) tanto en el editor
  como en la vista previa del email.

## Fase 3 — Programación + cola multi-día + historial

- [ ] Modelos `scheduled_send`, `send_batch`, `send_log` + migraciones con RLS
  (R12,R14,R18).
- [ ] Loop scheduler (lifespan): disparar vencidos, expandir en lotes por cuota
  diaria, claim atómico, batch send de Resend, progreso persistido (R13).
- [ ] Contador de cuota por credencial vía `config-email-org` + headers
  `x-resend-daily/monthly-quota` (R13, R21).
- [ ] Estado `draft` en `scheduled_send`: guardar/retomar/eliminar **borrador
  server-side** + tab Borradores (R22).
- [ ] Endpoints: `schedule`, `cancel`, `history`, `save-draft` (R12,R14,R15,R22).
- [ ] Frontend: programar, panel de cola en curso/programados/borradores,
  historial (real vs test) (R7-panel,R14,R22).
- [ ] Tests: claim atómico no duplica; reparto multi-día respeta cuota; cancelar
  frena lotes pending; failed sin reintento; historial sin contenido (R13-R15).

## Fase 4 — Integración de remitente + cumplimiento

- [ ] Integrar `config-email-org`: el envío usa `resolve_transport(campaign)` y
  el remitente resuelto (proveedor por org + campos cosméticos por campaña) —
  dependencia, sin duplicar aquí (R16, R17).
- [ ] Footer de cumplimiento + **desuscripción** funcional para clase *Anuncios*
  (R20) — coordinado con `email-cumplimiento-masivo`.
- [ ] Tests: desuscripción efectiva (revoca `notify_updates`); cuota derivada de
  `capabilities()` (no hardcodeada).

## Cierre

- [ ] Trazabilidad R1..R20 ↔ código ↔ tests (Reviewer).
- [ ] Retirar `AdherentCommsModal` y su trigger en `LifecyclePanelAdmin`.
- [ ] Actualizar `feature_list.json`: estado de `centro-comunicaciones` (usuario)
  y superseded de las specs absorbidas.
