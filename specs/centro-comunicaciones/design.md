# Design — centro-comunicaciones

## Arquitectura general

```
Frame admin (Next.js)  /admin/campanas/[id]/comunicaciones
  ├─ Editor de contenido (WYSIWYG + vista Código)  → HTML
  ├─ Carga de imágenes → POST /v1/campaigns/{id}/comms/uploads → URL pública
  ├─ Segmentación (tipo/ubicación/visibilidad/estado + clase) → conteo en vivo
  ├─ Vista previa / prueba / enviar ahora / programar
  └─ Panel: cola en curso + programados + historial

Backend (FastAPI)
  ├─ comms_service: construir HTML (sanitizar + envolver plantilla),
  │                  resolver segmento → emails, resolver remitente por campaña
  ├─ endpoints: preview, send (test/real), schedule, cancel, history, upload
  ├─ scheduler loop (lifespan): dispara vencidos + reparte por cuota diaria
  └─ Resend (_send / batch) con from/reply-to por campaña

Almacenamiento
  ├─ Postgres: scheduled_send / send_batch / send_log / comms_upload (RLS)
  └─ Disco VPS: /data/uploads/<org_id>/<campaign_id>/<uuid>.<ext>  (volumen)
```

## Relación con el código existente

- **Reusar**: `_build_delivery_event_invitation_html`, `_build_campaign_closing_html`,
  `_render_message_html`, `_social_icon_links`, `get_signer_emails_for_notify`,
  el transporte `_send`, y las funciones de conteo/segmento base de
  `campaign_service.py`. No duplicar armado de HTML (R6/R12 reconstruyen desde
  el payload guardado).
- **Migrar**: la lógica de las 3 pestañas del popup pasa a "tipos de envío" del
  frame. `AdherentCommsModal` y su apertura en `LifecyclePanelAdmin` se retiran
  al final (mantener hasta que el frame cubra los 3 tipos, para no perder
  funciones en el ínterin).
- **Extender**: `organization` ya tiene `domain`/`domains` (JSONB) — reutilizar
  para el remitente por dominio propio (R16).

## Decisiones técnicas

### Editor WYSIWYG (R3)
- Recomendado: **TipTap** (headless, TS, integra con React/Next 14, control
  total del HTML de salida y de la toolbar). Alternativas: Lexical (más código),
  Quill (menos TS-friendly). Evitar TinyMCE self-host por peso/licencia.
- El editor produce HTML semántico acotado; la vista "Código" muestra/edita ese
  HTML. Fuentes auto-hosteadas (regla del proyecto), no CDN.
- ⚠️ El HTML del editor **no** es el HTML final del email: se sanitiza (R6) y se
  **envuelve** en la plantilla email-safe (tabla + estilos inline) ya usada por
  el resto de emails. El editor edita el *cuerpo*, no el `<html>` completo.

### Sanitización + email-safe (R6)
- Backend: **`nh3`** (binding Rust de ammonia; rápido, mantenido) con allowlist
  explícita de etiquetas (`p,h1..h3,strong,em,ul,ol,li,blockquote,a,img,br,
  span`) y atributos (`href`, `src`, `alt`, alineación vía clase/limitada).
  Rechazar `script`, `style` embebido peligroso, `on*`, `javascript:`.
- `img@src` restringido a URLs de nuestro dominio de uploads (evita hotlink a
  terceros / tracking pixels no deseados).
- Envolver el cuerpo sanitizado con estilos inline en la plantilla existente;
  no depender de `<style>` (clientes de correo lo ignoran/eliminan).

### Bloques opcionales del email (R5b, R5c)
- **CTA(s)**: `[{text, url, enabled}]` (≥1 permitido). Se renderiza como botón
  pill con el color de acento de la campaña, insertado tras el cuerpo. URL
  normalizada con el mismo criterio de `_social_href` (anteponer `https://`).
  Persistido en el payload del envío (para reconstruir en la cola/programado).
- **Redes sociales**: toggle que incluye/omite el bloque `_social_icon_links`
  (reusa las URLs cargadas en el admin de la campaña/org; solo las que tengan
  valor). Sin bloque nuevo de datos — consume lo existente.

### Modelo de audiencia (UI, R8)
- Checkboxes "incluir por defecto, desmarcar para excluir" (más simple que
  chips): estado (Confirmadas / Pendientes), tipo, ubicación, visibilidad.
  "Secreta" aparece deshabilitada (nunca recibe). El backend traduce los
  checkboxes marcados a los `IN (...)` del constructor de segmento.

### Storage de imágenes (D2, R4, R19)

Las imágenes viven en un volumen del VPS (`/data/uploads/<org_id>/<campaign_id>/
<uuid>.<ext>`) y se sirven como URL pública. **Cómo servirlas** — 3 opciones:

**Opción A — FastAPI sirve `GET /media/<path>` (volumen montado solo en API)**
- Implicaciones: no toca nginx (respeta la regla de infra); validación/control en
  el backend; backup = un directorio. **Contra**: los estáticos pasan por el
  proceso Python (menos eficiente); un envío masivo dispara muchos fetch
  simultáneos del mismo asset → carga sobre workers del API.
- Mitigación fuerte: el asset es **inmutable** (nombre por uuid) → `Cache-Control:
  public, max-age=31536000, immutable`; clientes de correo y proxies cachean tras
  el primer fetch, así que el pico real sobre el API es acotado.

**Opción B — nginx sirve `location /media/` (volumen compartido API+nginx)**
- Implicaciones: nginx sirve estáticos con `sendfile`/cache, descarga por
  completo al API; mejor bajo picos de envío masivo. **Contra**: **toca la config
  nginx** (regla del proyecto: requiere autorización explícita del usuario);
  acopla dos contenedores al mismo volumen.

**Opción C — bucket S3-compatible**: descartada antes (servicio/infra nuevos).

**Recomendación**: **A para MVP/Fase 2** — más simple, no toca infra, y con cache
headers inmutables el costo de servir por Python es marginal (asset cacheado tras
el primer fetch). Migrar a **B** solo si la telemetría muestra que el API sufre
sirviendo imágenes en envíos grandes. B queda como mejora, pendiente de tu OK por
tocar nginx.

Validación (todas las opciones): MIME real por *sniffing* (no confiar en
extensión), tamaño ≤ 25 MB, formatos jpg/png/webp/gif, **SVG rechazado** (vector
con script), nombre `<uuid>.<ext>` no adivinable. Registro en `comms_upload`
(org_id, campaign_id, path, mime, bytes, created_by) con RLS (R18). Nota
entregabilidad: imágenes grandes perjudican; sugerir compresión (límite duro
25 MB por decisión del usuario).

### Segmentación (R8–R11)
- Constructor de query dinámico sobre `signatures` + `consents` con filtros:
  - `signer_type IN (...)`, ubicación (`country IS NULL` = Ecuador / `country
    IS NOT NULL` = internacional), `visibility IN (...)`, `status` (confirmed /
    pending_confirmation / ambos), `archived_at IS NULL`.
  - Clase *anuncios* fuerza `notify_updates=true` + `status=confirmed`.
  - Clase *servicio* + `pending_confirmation` ⇒ solo el tipo "recordatorio de
    confirmación"; el resto de tipos exige `confirmed`.
- **Secretas**: cuentan pero nunca se listan con PII; el envío descifra el email
  en memoria por fila, sin exponer nombre. Igual que hoy.
- Conteo en vivo: endpoint `POST /v1/campaigns/{id}/comms/recipients/count` con
  el segmento; barato (COUNT), sin descifrar PII.

### Remitente y proveedor → delegado a `config-email-org` (R16, R17)
- El centro **no** define plan ni credenciales. Consume `config-email-org`:
  `resolve_transport(campaign)` devuelve el adaptador + credenciales de la
  **org**, y la resolución de remitente aplica los campos cosméticos de la
  campaña (`sender_from`/`sender_reply_to`/`sender_display_name`) sobre los
  defaults de la org, validando dominio. Ver `specs/config-email-org`.
- El `from`/`reply_to` por llamada y el `send_batch` los provee el **adaptador
  resuelto**, no el cliente Resend hardcodeado (multi-proveedor).

### Cola multi-día por cuota (D4, R13)
- Modelo: un **envío** (scheduled_send) se expande en **lotes** (send_batch) de
  ≤ tamaño de cuota diaria del plan; el loop procesa los vencidos respetando un
  contador diario por campaña/plan.
- Contador de cuota: derivado de `config-email-org` — `capabilities().daily_quota`
  del transporte de la org, contado **por credencial de proveedor** (no por
  campaña). Varias campañas de una org que comparten credencial comparten la
  cuota; una org con credencial propia tiene la suya. Ver `config-email-org`
  (R6, R7). El centro no hardcodea 100/día.
- Claim atómico por lote: `UPDATE send_batch SET status='sending' WHERE id=...
  AND status='pending' RETURNING id`. Batch API de Resend (≤100/req) para enviar
  el lote de una.
- Reparto: mientras haya cuota del día y lotes vencidos, enviar; agotada la
  cuota, reprogramar el resto para el día siguiente. Progreso persistido (R14).

### Programación e historial (R12, R14, R15)
- `scheduled_send`: id, campaign_id, org_id, tipo, clase, subject, from/reply_to,
  segmento (JSON), payload de contenido (HTML sanitizado + CTA + flag redes +
  campos estructurados), scheduled_at (null si borrador), status
  (`draft|pending|sending|sent|cancelled|failed`), progreso.

### Borrador, navegación y sidebar (R22–R24)
- **Borrador (R22)**: un `scheduled_send` con `status=draft` y `scheduled_at=null`
  guarda el envío en curso server-side; se retoma cargándolo en el frame, y desde
  ahí se "envía ahora"/"programa" (pasa a `pending`) o se elimina. Autosave local
  (localStorage, patrón `useDraft` ya existente) como respaldo entre guardados
  explícitos.
- **Volver al admin (R23)**: link en el header del frame; el borrador/autosave
  preserva el progreso al navegar.
- **Sidebar colapsable (R24)**: **feature separada `admin-sidebar-colapsable`**
  (ver `specs/admin-sidebar-colapsable/`) — cambio en el shell admin
  (`AdminSidebarClient.tsx` + `layout.tsx`), no en `comunicaciones/`. El centro
  la consume como dependencia; se entrega por separado.
- `send_log`: id, campaign_id, org_id, tipo, clase, subject, recipient_count,
  mode (`real|test`), triggered_by, created_at. **Sin HTML** (R14).
- Cancelar: sólo si quedan lotes `pending`; marca el envío `cancelled` y frena
  los lotes no enviados. No edición in-place (R15).

## Esquema de datos (migraciones)

Head actual de Alembic: **035**. Esta feature agrega (numeración según orden de
merge, ver §Dependencias):
- `comms_upload` (imágenes) — RLS.
- `scheduled_send` (envíos/cola) — RLS.
- `send_batch` (lotes de la cola) — RLS vía join a scheduled_send / org_id.
- `send_log` (historial) — RLS.
- Campos **cosméticos** de remitente en `campaigns`: `sender_from`,
  `sender_reply_to`, `sender_display_name` (definidos en `config-email-org`).
  El proveedor/plan/credenciales viven en `org_email_config`
  (`config-email-org`), **no** aquí.

⚠️ **Coordinar heads de Alembic**: `programacion-historial-comunicaciones`
introducía `scheduled_email` + `email_send_log`. Como esta feature la absorbe,
**no** crear ambas: usar el esquema de aquí y marcar esa spec como superseded.
El `embudo-post-firma` (spec_ready) también introduce migración (`036`);
definir orden con el usuario para un solo head.

## Archivos afectados (orientativo)

### Backend
- `apps/api/app/models/` — `comms_upload.py`, `scheduled_send.py`,
  `send_batch.py`, `send_log.py`; campos de remitente en `campaign.py`.
- Migraciones Alembic nuevas (RLS incluido desde el inicio).
- `apps/api/app/services/comms_service.py` — armado+sanitización, segmento→emails,
  remitente por campaña, expansión en lotes.
- `apps/api/app/services/email_service.py` — `_send` acepta `from`/`reply_to`;
  batch send; reusar builders de HTML.
- `apps/api/app/services/scheduler.py` (o extensión del loop existente) — cola
  por cuota, claim atómico, progreso.
- `apps/api/app/routers/comms.py` — preview, send (test/real), schedule, cancel,
  history, recipients/count, uploads, media.
- `apps/api/app/config.py` — ruta de uploads, tamaño máx.

### Frontend
- `apps/web/src/app/admin/campanas/[id]/comunicaciones/page.tsx` + cliente.
- Componentes: editor WYSIWYG, cargador de imágenes, panel de segmentación,
  preview, panel de cola/programados/historial.
- `apps/web/src/lib/comms-api.ts`.
- Retirar `AdherentCommsModal` y su trigger en `LifecyclePanelAdmin` (al final).

## Seguridad

- JWT + rol + scope de campaña en todos los endpoints (patrón existente).
- Upload: sniff MIME, límite 25 MB, SVG rechazado, nombre no adivinable, RLS,
  rate limit HMAC (R19).
- Sanitización estricta del HTML del editor (R6); `img@src` sólo de nuestro
  dominio de uploads.
- Envío masivo detrás de confirmación explícita; cola cancelable (R15).
- RLS en todas las tablas nuevas (R18).

## LOPDP

- **Rol**: Encargado; la organización es Responsable.
- **Dos clases de envío (D1)**:
  - *Anuncios* — base **consentimiento** (`notify_updates`), revocable
    (portal ARCO + desuscripción en footer, R20). La segmentación nunca amplía
    el universo más allá de los consentidos.
  - *Servicio/transaccional* — base **ejecución/relación con el trámite** que el
    firmante apoyó (recordatorio de confirmación, invitación a la entrega, aviso
    de cierre). No requiere `notify_updates`, pero se limita a la propia campaña
    y a comunicaciones sobre ese trámite; a `pending_confirmation` sólo el
    recordatorio de confirmación.
- **Minimización**: el historial no guarda contenido ni PII (R14); los conteos
  no descifran PII; secretas nunca se listan.
- **Desuscripción** (R20): precondición de `email-cumplimiento-masivo`. Si esa
  feature no está lista, la clase *anuncios* **no** debe habilitarse en
  producción sin, al menos, un link de desuscripción funcional. Confirmar con el
  usuario el orden.
- **`privacy_config`**: no agrega finalidades nuevas por campaña (anuncios y
  comunicaciones de servicio ya están contempladas); confirmar que el aviso
  vigente cubre el envío de anuncios antes de habilitar esa clase.
- **`processing_contract_id`**: el envío opera bajo el contrato de encargo de la
  campaña (ya obligatorio).

## Flujo de diseño (regla del proyecto)

Feature frontend ⇒ **requiere diseño Claude Design aprobado antes de
`in_progress`**. El frame es una pantalla nueva y compleja (editor + segmentación
+ paneles): **sí** amerita ronda de Claude Design. Guardar el HTML exportado en
`specs/centro-comunicaciones/design-export.html`. Las imágenes de referencia del
usuario (editor tipo WordPress; chips de tipo/ubicación/visibilidad) son el
punto de partida visual.

## Dependencias / orden

- **Absorbe** `comunicaciones-cierre-campana` y `programacion-historial-
  comunicaciones` (marcar superseded al aprobar).
- **Depende** de `config-email-org` (remitente + proveedor + cuota por org) —
  el centro consume `resolve_transport` y `capabilities()`; no define proveedor
  ni credenciales (R16, R17).
- **Depende** de `email-cumplimiento-masivo` (footer + desuscripción) para
  habilitar la clase *anuncios* (R20).
- **Alembic**: coordinar un solo head con `embudo-post-firma` (036) y con lo que
  esta feature agregue.
- **Infra**: volumen de uploads en el VPS (docker-compose) — sin servicios
  globales nuevos; confirmar montaje.

## Fases de implementación sugeridas (ver tasks.md)

1. **Frame + editor + segmentación + envío inmediato** (reemplaza el popup;
   remitente por campaña; sin cola ni programación todavía).
2. **Storage de imágenes**.
3. **Programación + cola multi-día + historial** (absorbe la otra spec).
4. **Remitente por dominio propio (Pro)** + footer/desuscripción
   (coordinado con email-cumplimiento-masivo).
