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

### Frontend
- [ ] Página `/admin/campanas/[id]/comunicaciones` + cliente (R1).
- [ ] Editor WYSIWYG (TipTap) con toolbar (R3) + vista Código.
- [ ] Bloques del email: CTA(s) editable(s) con preview + toggle redes sociales
  (R5b, R5c).
- [ ] Panel de audiencia con **checkboxes** ("incluir todos, desmarcar para
  excluir") + conteo en vivo + contador de cuota (R8, R10, R21).
- [ ] Preview real + envío de prueba + enviar ahora (R7).
- [ ] Autosave local del borrador (`useDraft`) + acción "Volver al admin de
  campaña" (R22 parcial — server-side en Fase 3; R23).
- [ ] `comms-api.ts`.
- [ ] Mantener el popup operativo hasta cubrir los 3 tipos; luego retirarlo.

### Dependencia de shell (R24)
- [ ] Sidebar contraíble → **feature separada `admin-sidebar-colapsable`**
  (specs propias). El centro la consume; no se implementa aquí.

## Fase 2 — Storage de imágenes

- [ ] Volumen de uploads (docker-compose) + config (ruta, tamaño máx).
- [ ] Modelo `comms_upload` + migración con RLS (R18).
- [ ] `POST /comms/uploads`: sniff MIME, ≤25 MB, formatos permitidos, SVG
  rechazado, nombre no adivinable, rate limit HMAC (R4,R19).
- [ ] `GET /media/<path>` (o location nginx) con cache headers.
- [ ] Editor: insertar imagen subida por URL (R4); `img@src` restringido al
  dominio de uploads (R6).
- [ ] Tests: rechazo de tipo/tamaño/SVG; RLS de uploads.

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
