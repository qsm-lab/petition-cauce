# Tasks — export-entrega

> Depende de cifrado-reposo (desplegado). Redis existente.

## Backend

- [ ] **T1** Migración: tabla `pii_export_audit` + RLS org/platform_admin (R8)
- [ ] **T2** Modelo `PiiExportAudit`
- [ ] **T3** `pii_export_service.request_otp(db, user, campaign, password)`: verifica bcrypt, genera OTP, hash en Redis TTL 600, rate 3/hora (R2, R3)
- [ ] **T4** `pii_export_service.verify_otp(user, campaign, code)`: compare_digest, 3 intentos, emite download_token single-use TTL 300 (R3, R4)
- [ ] **T5** `pii_export_service.generate_csv(db, campaign, export_id)`: confirmadas, sin secretas ni archivadas/anonimizadas, PII descifrada, columna export_id, conteo de secretas excluidas (R5, R6, R7)
- [ ] **T6** Auditoría: INSERT `pii_export_audit` en la descarga (R8)
- [ ] **T7** `email_service.send_export_otp_email` (código, campaña, aviso de no compartir) (R2)
- [ ] **T8** `email_service.send_export_notification` al Responsable + platform admins (export_id, filas, deber de custodia) (R9)
- [ ] **T9** Router: `POST .../export-entrega/request`, `POST .../verify`, `GET .../download?token=` — JWT, rol, campaña→org, gating `lifecycle_stage >= 2` (409), slowapi (R1, R10)

## Frontend

- [ ] **T10** Botón "Descarga de entrega" en dashboard de firmas, solo si etapa ≥ Entrega (R1)
- [ ] **T11** Modal 2 pasos: password → código OTP → descarga automática; errores genéricos; estados enviando/reintentos (R2–R4, R10)
- [ ] **T12** `admin-signatures-api.ts`: `requestExportEntrega`, `verifyExportEntrega`, descarga con token

## Tests (R11)

- [ ] **T13** Gating por etapa: 409 antes de Entrega; botón condicionado (unit front opcional)
- [ ] **T14** Flujo feliz completo: password → OTP → token → CSV con PII en claro y export_id
- [ ] **T15** Exclusiones: secretas fuera + conteo declarado; archivadas/anonimizadas fuera
- [ ] **T16** OTP: expiración, 3 intentos y invalidación, rate limit 3/hora
- [ ] **T17** Token: single-use (segundo GET falla), expiración 300s
- [ ] **T18** Auditoría sin PII; notificaciones enviadas (mock)
- [ ] **T19** Permisos: 401 sin JWT, 403 rol sin acceso, campaña de otra org

## Verificación local

- [ ] **T20** Flujo completo en dev con campaña en etapa Entrega (OTP visible en logs sin RESEND_API_KEY); verificar CSV, auditoría y single-use del token
