# Tasks — supresion-admin

> Depende de retencion-datos (anonymize_signature, scheduler, anonymized_at).

## Backend

- [x] **T1** Migración: `signatures.archived_at`, `archived_by`, `purge_after` (R2) — migración 019, incluye también `arco_requests` (adelantada de derechos-arco, ver design.md)
- [x] **T2** Modelo `Signature`: columnas nuevas
- [x] **T3** `admin_signature_service.archive_signature(db, sig, admin_id)`: marca columnas, `purge_after = now()+15d` (R2)
- [x] **T4** `email_service.send_archive_notification(email, campaign_title, purge_date)` (R3)
- [x] **T5** Auditoría en `arco_requests` (supresion, trigger=admin) al archivar y restaurar (R4, R6)
- [x] **T6** `admin_signature_service.unarchive_signature` — solo si `anonymized_at IS NULL` (R6)
- [x] **T7** Exclusiones R7: export CSV, `get_signer_emails_for_notify`, feed de recientes
- [x] **T8** `retention_service`: cola de purga `purge_after <= now() AND anonymized_at IS NULL` en el job diario (R8, R10)
- [x] **T9** Router: `POST .../signatures/{id}/archive` y `.../unarchive`, rol admin, validación campaña→org (R1)
- [x] **T10** `list_signatures`: exponer `archived_at`, `purge_after`, `anonymized_at` para los badges (R5, R9)

## Frontend

- [x] **T11** Columna de acciones en la tabla de firmas: botón "Archivar" / "Restaurar" según estado (R1, R5)
- [x] **T12** `ArchiveModal.tsx`: confirmación 2 pasos con el texto de R1
- [x] **T13** Badges: "Archivada — purga el X" (ámbar) y "Suprimida" (gris) (R5, R9)
- [x] **T14** `admin-signatures-api.ts`: `archiveSignature`, `unarchiveSignature`

## Tests (R11)

- [x] **T15** Archivar: columnas seteadas, email enviado, auditoría sin PII
- [x] **T16** Exclusiones: archivada no aparece en export ni en notify ni en feed
- [x] **T17** Restaurar dentro de ventana; rechazo tras purga
- [x] **T18** Purga: PII eliminada, conteo intacto (campaña activa y terminada), idempotente
- [x] **T19** Permisos: 401 sin JWT, 403 sin rol admin

## Verificación local

- [x] **T20** Flujo completo con `purge_after` forzado a pasado → job → badge "Suprimida", contador igual — verificado manualmente con firma de prueba en `prueba-001` (campaña real intacta)
