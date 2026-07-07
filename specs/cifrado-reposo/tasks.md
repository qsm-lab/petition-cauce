# Tasks — cifrado-reposo

## Preparación (usuario)

- [ ] **T0** Generar clave: `openssl rand -hex 32` → agregar `PII_ENCRYPTION_KEY` a `.env.dev` local y `.env` del VPS (R2) — **antes del deploy**

## Backend

- [ ] **T1** `config.py`: setting `pii_encryption_key` + validación de arranque (falta o tamaño ≠ 64 hex → error claro) (R2, R3)
- [ ] **T2** `crypto.py`: `encrypt_pii()` — AESGCM, nonce 12 bytes `os.urandom`, formato `enc:v1:<base64url(nonce||ct||tag)>` (R1, R4, R5)
- [ ] **T3** `crypto.py`: `decrypt_pii(token, ref=)` + excepción `PIIDecryptError`; log sin valor en claro (R6, R9)
- [ ] **T4** `signature_service.create_signature`: cifrar `email_normalized` y `cedula` al construir `Signature`; eliminar comentario "Fase 1: stored as-is" (R1)
- [ ] **T5** `campaign_service.get_signer_emails_for_notify`: descifrar emails antes de retornar (R6)
- [ ] **T6** `requirements.txt`: fijar `cryptography` explícita
- [ ] **T7** `.env.example`: documentar `PII_ENCRYPTION_KEY`

## Migración

- [ ] **T8** Migración `015_encrypt_pii_at_rest.py`: cifra valores legados sin prefijo `enc:`, por lotes, idempotente (R8)

## Tests (R10)

- [ ] **T9** Roundtrip encrypt/decrypt; nonce distinto en dos cifrados del mismo valor
- [ ] **T10** `decrypt_pii` falla limpio con clave errónea / dato corrupto / valor sin prefijo
- [ ] **T11** Arranque sin `PII_ENCRYPTION_KEY` → error (test de settings)
- [ ] **T12** Migración idempotente: correr dos veces no re-cifra (prefijo detectado)
- [ ] **T13** E2E: crear firma → fila en DB tiene `enc:v1:` en email/cedula → notify-signers descifra y obtiene el email original

## Verificación local

- [ ] **T14** `make dev` + firma de prueba → `SELECT email_encrypted FROM signatures ORDER BY created_at DESC LIMIT 1` muestra `enc:v1:...`
- [ ] **T15** Flujo confirmación por email sigue funcionando (token llega al email correcto)
