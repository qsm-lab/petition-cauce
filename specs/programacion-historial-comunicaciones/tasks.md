# Tasks — programacion-historial-comunicaciones

## Backend — base (migración + modelos)
- [ ] T1 — Migración: tablas `scheduled_email` + `email_send_log`, RLS (R12)
- [ ] T2 — Modelos `ScheduledEmail`, `EmailSendLog`

## Backend — Programar envío (prioridad 1)
- [ ] T3 — `schemas/email_scheduling.py`: `ScheduleEmailRequest` (R1, R2)
- [ ] T4 — `email_scheduling_service.py`: `create_scheduled_email`, `list_scheduled_emails`, `cancel_scheduled_email` (R5, R7)
- [ ] T5 — `email_scheduling_service.py`: `claim_due_scheduled_emails` (atómico, R4) + `dispatch_scheduled_email` (reconstruye por `type`, R3, R6)
- [ ] T6 — `email_scheduler_runner.py`: loop asíncrono 60s (R3) + wiring en `main.py` lifespan
- [ ] T7 — Endpoints: `POST schedule-email`, `GET scheduled-emails`, `DELETE scheduled-emails/{id}` (R13)
- [ ] T8 — Tests: claim atómico no duplica, cancelado/enviado nunca se dispara (R17); reconstrucción correcta por tipo (R18)

## Backend — Historial (prioridad 2)
- [ ] T9 — `email_log_service.py`: `log_send(...)`
- [ ] T10 — Wiring: `log_send` al final de los 4 endpoints de envío ya existentes (event-invitation, closing-notification, notify-signers) + dentro de `dispatch_scheduled_email`
- [ ] T11 — Endpoint `GET email-log` (R10)
- [ ] T12 — Test: historial no persiste HTML/contenido (R19)

## Frontend
- [ ] T13 — `admin-lifecycle-api.ts`: `scheduleEmail`, `listScheduledEmails`, `cancelScheduledEmail`, `listEmailLog`
- [ ] T14 — Cada tab del popup: selector fecha/hora + botón "Programar" + lista de pendientes con "Cancelar"
- [ ] T15 — `EmailHistoryTab.tsx`: nueva 4ta pestaña del popup con el historial

## Verificación
- [ ] T16 — Probar en dev: programar un envío a +2 minutos, confirmar que el loop lo dispara solo sin refrescar nada
- [ ] T17 — Probar en dev: cancelar un envío programado antes de que dispare, confirmar que no llega
- [ ] T18 — Confirmar en el historial que envíos de prueba y reales quedan distinguibles (R9)
