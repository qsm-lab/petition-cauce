# Design — comunicaciones-cierre-campana

## Flujo

```
[Admin] panel de ciclo de vida (LifecyclePanelAdmin.tsx)
  └─ botón único "Comunicaciones de cierre" → abre ClosingCommsModal (popup)
       ├─ Tab "Invitación al evento"
       │    formulario: fecha/hora*, lugar*, link mapa, imagen URL, mensaje
       │      → [Vista previa]  POST .../event-invitation/preview  → {html}
       │        (se muestra en <iframe srcDoc={html}> dentro del popup)
       │      → [Enviar prueba] campo abierto de emails + botón
       │        POST .../event-invitation  {..., test_emails: [...]}
       │      → [Enviar a firmantes] muestra conteo de audiencia nacional
       │        confirmada antes de confirmar →
       │        POST .../event-invitation  {...}  (sin test_emails)
       │        ← { sent_count }
       │
       └─ Tab "Aviso de cierre"
            → [Vista previa]  POST .../closing-notification/preview → {html}
            → [Enviar prueba] mismo patrón, POST .../closing-notification
              {test_emails: [...]}
            → [Enviar a firmantes] preview de conteo final + destinatarios →
              POST .../closing-notification {}  (sin test_emails)
              ← { sent_count, final_count }

[Admin] dashboard de firmas → botón "Recordar a pendientes" (sin cambios de
  mecanismo, NO entra al popup) → remind_pending_signatures() ahora llama a
  send_confirmation_reminder_email() en vez de send_confirmation_email()
```

Ninguno de los tres envíos es automático: los tres requieren un click
deliberado del admin. El cambio de `status` a `closed` (ya existente, sesión
31) sigue sin efectos secundarios de email — se mantiene desacoplado a
propósito (R5).

**Vista previa = paridad exacta con el envío real (R20).** Cada email tiene
una función `_build_..._html(...)` que arma el string HTML; tanto el
endpoint de preview como la función de envío llaman a la misma función — no
hay una segunda plantilla en el frontend que se pueda desincronizar.

**Envío de prueba (R21).** Si `test_emails` viene con datos en el body, el
endpoint manda el mismo HTML solo a esas direcciones (sin tocar
`get_signer_emails_...`) y responde `{sent_count, mode: "test"}`. Si viene
vacío/ausente, es el envío real a la audiencia calculada. Mismo endpoint,
un solo branch — evita duplicar rutas.

## Modelo

**Sin migraciones.** Los tres emails son acciones puntuales (compose-and-send),
igual que el "Notificar a firmantes" ya existente — no se persisten los datos
del evento ni del cierre en ninguna tabla nueva.

## Archivos afectados

### Backend
| Archivo | Cambio |
|---------|--------|
| `apps/api/app/schemas/campaign.py` | `EventInvitationRequest` (event_title?, event_datetime, event_location, event_map_url?, event_image_url?, message?, test_emails?), `ClosingNotificationRequest` (test_emails?) |
| `apps/api/app/services/campaign_service.py` | `get_signer_emails_nacional_confirmed(db, campaign_id)`, `get_signer_emails_todos_confirmed(db, campaign_id)` — variantes de `get_signer_emails_for_notify` sin el filtro `notify_updates`; la primera suma `Signature.country.is_(None)` |
| `apps/api/app/services/email_service.py` | `_build_delivery_event_invitation_html(...)` / `send_delivery_event_invitation_email(...)`, `_build_campaign_closing_html(...)` / `send_campaign_closing_email(...)`, `send_confirmation_reminder_email(...)` — las tres reusan la base visual `_signer_action_html` / el estilo de `_PLATFORM_FOOTER_HTML`; las dos primeras separan "construir HTML" de "mandar" para que preview y envío compartan la misma función |
| `apps/api/app/routers/campaigns.py` | 4 endpoints nuevos: `POST /{campaign_id}/lifecycle/event-invitation` (+ `test_emails` opcional en el body), `POST /{campaign_id}/lifecycle/event-invitation/preview`, `POST /{campaign_id}/lifecycle/closing-notification` (+ `test_emails`), `POST /{campaign_id}/lifecycle/closing-notification/preview` — mismo patrón de auth/scope que `notify_signers` |
| `apps/api/app/routers/admin_signatures.py` | `remind_pending_signatures`: cambia la llamada de `send_confirmation_email` a `send_confirmation_reminder_email` (mismo query, mismo endpoint, sin cambios de firma) |
| `apps/api/tests/test_comunicaciones_cierre.py` | R17, R18, R23 |

### Frontend (adiciones a pantalla admin existente — sin ronda Claude Design)
| Archivo | Cambio |
|---------|--------|
| `apps/web/src/app/admin/campanas/[id]/LifecyclePanelAdmin.tsx` | se agrega un botón nuevo "Comunicaciones de cierre" (junto a "Notificar a firmantes", que no cambia) que abre `ClosingCommsModal` |
| `apps/web/src/app/admin/campanas/[id]/ClosingCommsModal.tsx` | nuevo — popup con 2 tabs (evento / cierre), cada uno con formulario, vista previa (iframe), campo de emails de prueba + envío de prueba, y envío real con preview de conteo |
| `apps/web/src/lib/admin-lifecycle-api.ts` | `previewEventInvitation()`, `sendEventInvitation(data, testEmails?)`, `previewClosingNotification()`, `sendClosingNotification(testEmails?)` |

**Nota de criterio (a confirmar con el usuario):** siguiendo el precedente de
`export-entrega` (sesión 31, mismo tipo de adición — botones/formularios
nuevos sobre una pantalla admin interna ya existente), esta spec asume que
NO requiere ronda de Claude Design, porque no es una pantalla pública nueva
sino campos añadidos a un panel admin interno ya diseñado. Si el usuario
prefiere pasar estos dos formularios por Claude Design de todas formas,
avisar antes de implementar.

## Plantillas de email (estilo)

Las tres reusan la paleta ya establecida en `email_service.py` (fondo
`#f4f5f0`, tarjeta blanca redondeada, acento `#3d6b35`, texto `#1a2516` /
`#7a8a72`, footer de plataforma `_PLATFORM_FOOTER_HTML`) — sin diseño nuevo,
consistencia con confirmación/agradecimiento/cambio-de-visibilidad ya
existentes.

- **Invitación al evento**: banner de imagen (si hay `event_image_url`) →
  encabezado → bloque destacado de fecha/hora + lugar → botón "Ver ubicación"
  (si hay `event_map_url`) → mensaje libre (si hay) → footer.
- **Cierre**: encabezado "La campaña cerró" → conteo final destacado (mismo
  estilo que el contador de `StepThanks.tsx`) → bloque de enlaces (solo los
  `social_links` con valor: ícono + label + link) → footer.
- **Recordatorio (reemplaza el heading/body de `send_confirmation_email` para
  este caso, no la función original)**: mismo botón CTA "Confirmar firma",
  pero el cuerpo aclara explícitamente que la adhesión ya cuenta para la
  petición y que confirmar solo activa el resto de beneficios (aparecer en
  el documento de entrega con nombre, según visibilidad elegida).

## Seguridad

- Mismo patrón de auth que endpoints hermanos: JWT + rol `admin`/`gestor` +
  `_get_owned_campaign`/`_org_scope` (multi-tenant, org no puede notificar
  campañas ajenas).
- Rate limiting slowapi en los 2 endpoints nuevos (R16), mismo rango que
  `remind-pending` (3-5/minuto) — son acciones de un solo click, no hay caso
  de uso legítimo de alta frecuencia.
- Los emails de firmantes se descifran solo en memoria para el envío
  (`decrypt_pii`, mismo patrón que el resto del código) — no se loguean en
  claro, no se persisten en ninguna tabla nueva.

## LOPDP

- **Base legal (R2/R6)**: informar sobre el evento de entrega y el resultado
  del cierre se trata como parte de la ejecución del fin declarado de la
  petición (interés legítimo del proceso mismo que el firmante inició al
  adherirse) — no como comunicación de "novedades" bajo consentimiento
  opcional (ese consentimiento, `notify_updates`, nunca se ha capturado
  realmente — ver Contexto en requirements.md). Es la misma base ya usada de
  forma implícita por el email de confirmación de firma y por
  `notify_signers`/cambios de etapa, que ya existían antes de esta spec.
- **Minimización**: no se agrega ninguna categoría de dato nueva ni
  destinatario nuevo — se reutiliza el email ya capturado y descifrado con
  el mismo mecanismo (`decrypt_pii`) que el resto de emails transaccionales
  de la plataforma.
- **Sin nuevo RAT**: no cambia el propósito declarado del tratamiento; es
  una comunicación operativa del ciclo de vida ya contemplado (`entrega`,
  `decisión`) en el propio modelo (`lifecycle_stage`, `LifecycleEvent`).
- **Auditoría**: se decide, por alcance y urgencia de hoy, NO crear una
  tabla de auditoría nueva para estos envíos (a diferencia de
  `pii_export_audit` en `export-entrega`) — son envíos a direcciones ya
  usadas rutinariamente para el mismo propósito (confirmación, cambios de
  etapa), no una exposición nueva de PII a un tercero. Si el usuario
  prefiere dejar rastro explícito (quién disparó el envío y cuántos
  destinatarios), se puede sumar un log estructurado sin necesidad de tabla
  nueva — a confirmar.

## Dependencias

- `ciclo-vida-admin` (in_progress): estos envíos viven en el mismo panel y
  reusan `_org_scope`/`_get_owned_campaign`.
- `dashboard-firmas`: `remind_pending_signatures` es el mismo endpoint, solo
  cambia el email que dispara.
- Reutiliza `social_links` (ya existente, campo `campaign.meta.social_links`,
  editable en `CampanaEditorClient.tsx`) — sin cambios en ese editor.
- Independiente de `retencion-datos`/`supresion-admin`/`derechos-arco` (rama
  `dev`, se libera hoy) — no hay conflicto de archivos tocados.

## Hallazgo documentado (no se corrige en esta spec)

`Consent.notify_updates` y el checkbox de `StepThanks.tsx` → `SignFlow.tsx`
(`onSubscribe` sin cablear) están rotos desde que se escribieron — nunca
capturaron un consentimiento real. Afecta también al "Notificar a firmantes"
ya existente (`get_signer_emails_for_notify`), que probablemente siempre
devolvió 0 destinatarios en cualquier campaña. Corregirlo es alcance de una
spec futura (`embudo-post-firma` o `novedades-campana`, ambas `pending`), con
su propio diseño de consentimiento independiente — no se toca aquí (R12).

---

## Addendum — feedback de diseño sobre el email de invitación (sesión 32)

Tras la primera implementación, el usuario pidió 9 ajustes puntuales al email
de invitación al evento (no afecta al de cierre ni al recordatorio):

1. Eyebrow "CAUCE ECUADOR" (org_label) → texto fijo "+CAUCES", tipografía
   Work Sans (la que usa el admin) y color más tenue (`#9aaa92`, no destaca).
2. Saludo personalizado por firmante: "{primer nombre}, la campaña
   **{título}** te invita a participar del evento de entrega de la petición
   que apoyaste con tu firma." Esto obligó a dejar de mandar un único HTML
   compartido a toda la audiencia — ahora se genera un HTML por destinatario
   (`send_delivery_event_invitation_email` recibe `(email, nombre)`, no solo
   emails; nueva función `CampaignService.get_signer_emails_and_names_nacional_confirmed`).
3. Campo `event_subtitle` (opcional) dentro del recuadro de datos del evento.
4. Botones de agendar: Google Calendar y Outlook (deep links propios,
   construidos en `_calendar_links()`) + Apple Calendar vía un `.ics`
   generado on-demand por un endpoint público nuevo,
   `GET /v1/public-campaign/calendar.ics` (sin persistencia, duración fija
   de 2h ya que no se captura hora de fin en el formulario).
5. Botón "Ver ubicación": de pastilla sólida a link de texto simple
   (`color:#3d6b35`, sin fondo, `font-size:12px`) — ya no destaca.
6. Redes sociales de la campaña (`campaign.social_links`) al final del
   email, solo las que tengan URL cargada. **Decisión de diseño**: se
   implementaron como links de texto con fondo suave (mismo patrón que el
   email de cierre), NO como imágenes de ícono — Gmail bloquea `data:` URIs
   en `<img>` (ya documentado en sesión 27 con el QR del email de
   agradecimiento) y no hay pipeline de assets para hostear íconos PNG/SVG
   reales. Si se quieren íconos gráficos de verdad, hace falta resolver
   primero el hosting de esos assets — fuera de alcance de hoy.
7. Footer "+Cauces.org" → "+Cauces" (se quita el `.org`, sin link) — el
   usuario confirmó que el dominio de plataforma todavía no existe; se
   agregará el link cuando esté disponible. Aplica a los 3 emails (usan el
   mismo `_PLATFORM_FOOTER_HTML`).
8. Campo "Asunto" editable en el popup (`EventInvitationRequest.subject`,
   opcional — si se deja vacío, el backend usa el default
   `f"Te invitamos: entrega de {campaign_title}"`).
9. **No implementado, agregado al backlog**: cumplimiento de emails masivos
   (términos de uso/política de privacidad de la plataforma, desuscripción,
   "ver en el navegador") — nueva feature `email-cumplimiento-masivo`
   (`pending`, `sdd: true`) en `feature_list.json`, cruza los 3 emails de
   esta spec más "Notificar a firmantes" y el recordatorio existente.

### Archivos afectados (adicional a la tabla original)
| Archivo | Cambio |
|---------|--------|
| `apps/api/app/routers/public_campaign.py` | endpoint nuevo `GET /calendar.ics` (genera .ics on-demand, sin auth, sin persistencia) |
| `apps/api/app/services/campaign_service.py` | `get_signer_emails_and_names_nacional_confirmed()` — nueva, devuelve `(email, name)`; `get_signer_emails_nacional_confirmed()` ahora la reusa |
| `apps/api/app/services/email_service.py` | `_calendar_links()`, `_ics_escape()`, `_EVENT_SOCIAL_LABELS`; `_build_delivery_event_invitation_html`/`send_delivery_event_invitation_email` reescritas con `event_subtitle`, `signer_name`, `social_links`, `subject_override` |
| `apps/api/app/schemas/campaign.py` | `EventInvitationRequest` +`event_subtitle`, +`subject` |
| `apps/web/.../ClosingCommsModal.tsx` | campos nuevos "Subtítulo" y "Asunto" en el tab de evento |
