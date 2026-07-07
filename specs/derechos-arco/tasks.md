# Tasks — derechos-arco

> Dependencias: retencion-datos (anonymize_signature) y cifrado-reposo (decrypt_pii)
> deben estar implementadas primero. Frontend requiere Claude Design aprobado.

## Backend — modelos y migración

- [ ] **T1** Modelo `ArcoRequest` + migración `017_arco.py` (tabla + columnas token en signatures) (R10)

## Backend — servicio

- [ ] **T2** `arco_service.request_access(db, campaign, email, cedula)`: valida hashes, genera token (hasheado en DB, 1h), envía email; SIEMPRE retorna respuesta genérica (R1, R2, R3)
- [ ] **T3** `arco_service.verify_token(db, token)`: un solo uso, expira 1h → emite token de sesión de portal 30 min (R3)
- [ ] **T4** `arco_service.get_subject_data(...)`: datos + consentimiento, cédula enmascarada (R5)
- [ ] **T5** `arco_service.rectify(...)`: solo `name`, `provincia`/`country`, `visibility` (R6)
- [ ] **T6** `arco_service.oppose(...)`: toggles `notify_updates`/`subscribe_newsletter` (R8)
- [ ] **T7** `arco_service.export_data(...)`: JSON y CSV on-demand, sin persistir archivo (R9)
- [ ] **T8** `arco_service.delete_subject(...)`: anonimización inmediata vía `retention_service.anonymize_signature` + confirmación email (R7)
- [ ] **T9** Registro en `arco_requests` en cada operación, solo `email_hash` (R10)
- [ ] **T10** `email_service`: `send_arco_verification_email` + `send_arco_org_notification` (sin PII del titular) (R11)

## Backend — router

- [ ] **T11** `routers/arco.py`: endpoints públicos con Turnstile + rate limit 3/h por IP; respuesta genérica uniforme, incluso para firmas anonimizadas (R2, R4, R12)

## Frontend (tras Claude Design)

- [ ] **T12** Diseño Claude Design de `/mis-datos` y portal → `design-export.html` aprobado
- [ ] **T13** Página `/mis-datos`: formulario email+cédula+Turnstile
- [ ] **T14** Portal: vista de datos, rectificación, oposición, descarga, supresión con doble confirmación

## Tests (R13)

- [ ] **T15** Anti-enumeración: misma respuesta para email existente/inexistente/anonimizado
- [ ] **T16** Token: expiración 1h, un solo uso, sesión portal 30 min
- [ ] **T17** Cada derecho: acceso, rectificación (solo campos permitidos), oposición, portabilidad (estructura JSON), supresión (firma anonimizada, contador intacto)
- [ ] **T18** Auditoría sin PII + rate limiting activo
