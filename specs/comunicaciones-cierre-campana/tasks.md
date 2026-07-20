# Tasks — comunicaciones-cierre-campana

## Backend

- [x] T1 — `schemas/campaign.py`: `EventInvitationRequest`, `ClosingNotificationRequest`, ambas con `test_emails: list[EmailStr] | None = None` (R1, R5, R21)
- [x] T2 — `campaign_service.py`: `get_signer_emails_nacional_confirmed()` (R2), `get_signer_emails_todos_confirmed()` (R6) — excluyen `anulada`
- [x] T3 — `email_service.py`: `_build_delivery_event_invitation_html()` + `send_delivery_event_invitation_email()` que la reusa (R1, R3, R4, R20)
- [x] T4 — `email_service.py`: `_build_campaign_closing_html()` + `send_campaign_closing_email()` que la reusa (R5, R7, R20)
- [x] T5 — `email_service.py`: `send_confirmation_reminder_email()` — copy nuevo, no toca `send_confirmation_email` (R9, R10, R11)
- [x] T6 — `routers/campaigns.py`: `POST /{campaign_id}/lifecycle/event-invitation` (branch real/test por `test_emails`) + `POST .../event-invitation/preview` (R1, R2, R15, R16, R21) — incluye `recipient_count` en el preview (R22)
- [x] T7 — `routers/campaigns.py`: `POST /{campaign_id}/lifecycle/closing-notification` (branch real/test) + `POST .../closing-notification/preview` (R5, R6, R8, R15, R16, R21) — incluye `recipient_count` en el preview (R22)
- [x] T8 — `routers/admin_signatures.py`: `remind_pending_signatures` usa `send_confirmation_reminder_email` (R9, R11)
- [x] T9 — Tests: `test_comunicaciones_cierre.py`, 9 tests — builders de HTML (condicionales de mapa/imagen/links) y validación de schemas. **Nota de cobertura**: los tests de audiencia (`get_signer_emails_..._nacional_confirmed`, `_todos_confirmado`, exclusión `anulada`, filtro `name IS NOT NULL` scoped a la campaña) NO tienen test automatizado — el repo no tiene fixture de DB para tests unitarios (ver docstring del archivo). Se verificaron manualmente vía httpx contra la DB de dev (login + preview + test-send), no vía pytest. Pendiente si se quiere cobertura real: agregar fixture de DB al repo (fuera de alcance de hoy).

**Suite completa: 74/74 tests pasan** (65 preexistentes + 9 nuevos), sin regresiones.

## Frontend

- [x] T10 — `admin-lifecycle-api.ts`: `previewEventInvitation()`, `sendEventInvitation(data, testEmails?)`, `previewClosingNotification()`, `sendClosingNotification(testEmails?)`
- [x] T11 — `LifecyclePanelAdmin.tsx`: botón único "Comunicaciones de cierre" que abre `ClosingCommsModal` (R19)
- [x] T12 — `ClosingCommsModal.tsx`: tab "Invitación al evento" — formulario + vista previa (iframe) + emails de prueba + envío real con conteo (R1-R4, R20-R22)
- [x] T13 — `ClosingCommsModal.tsx`: tab "Aviso de cierre" — vista previa (iframe) + emails de prueba + envío real con conteo final (R5-R8, R20-R22)

`tsc --noEmit` sin errores. Página `/admin/campanas/[id]` renderiza (HTTP 200, botón presente en el HTML) probada con cookie de sesión real vía wget. **No se probó visualmente en navegador** (sin herramienta de screenshot/browser disponible en esta sesión) — falta que el usuario confirme el render visual real del modal, los 2 tabs y los iframes de preview.

## Verificación antes de cerrar la campaña de hoy

- [ ] T14 — Probar en dev (navegador real): vista previa de invitación al evento (banner, fecha/hora, botón de mapa) y envío de prueba a un email propio — **pendiente, requiere el usuario**
- [ ] T15 — Probar en dev (navegador real): vista previa de aviso de cierre con `social_links` parcialmente vacíos (confirmar que omite los campos sin valor) y envío de prueba — **pendiente, requiere el usuario**
- [ ] T16 — Confirmar conteo de destinatarios reales en producción antes de disparar el envío masivo real (usar el preview del modal, no solo confiar en el número esperado) — **pendiente, es sobre producción**
