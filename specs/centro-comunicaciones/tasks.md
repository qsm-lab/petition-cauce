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

### Backend
- [ ] Campos **cosméticos** de remitente en `campaigns`: `sender_from`,
  `sender_reply_to`, `sender_display_name` (proveedor/plan/credenciales van en
  `config-email-org`) (R16).
- [ ] Envío vía `resolve_transport(campaign)` de `config-email-org`; el centro
  no maneja credenciales (R16, R17). Si `config-email-org` no está lista aún,
  usar el default de plataforma temporalmente.
- [ ] `comms_service`: sanitizar HTML del editor (`nh3`, allowlist) + envolver en
  plantilla email-safe (R6); constructor de segmento → emails (R8–R11) con las
  reglas por clase (D1); reusar builders de invitación/cierre.
- [ ] Endpoints: `preview`, `send` (test/real), `recipients/count` (R7,R10);
  JWT+rol+scope (R2).
- [ ] Tests: segmentación por clase/estado/visibilidad (incl. exclusión de
  secretas y bloqueo de anuncios a no-consentidos, R11); sanitización (R6);
  remitente por campaña (R16).

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
