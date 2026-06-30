# Tasks — anti-fraude-basico
> Referencia: requirements.md R1–R14

---

## Schema Pydantic

- [ ] T1 — `app/schemas/signature.py`: `SignatureCreate` con campos `name`, `email`, `cedula`, `provincia`, `visibility` (`pub|anon|sec`), `signer_type`, `consent`, `subscribe_newsletter`, `cf_turnstile_token` (R1, R8)

## Turnstile

- [ ] T2 — `app/services/turnstile_service.py`: `verify_turnstile(token: str, ip: str) -> bool` — POST a `https://challenges.cloudflare.com/turnstile/v0/siteverify`; retorna True si `success: true` (R2)
- [ ] T3 — Bypass automático en dev cuando `settings.turnstile_secret_key` es la clave test de CF (R3)

## Endpoint POST /signatures

- [ ] T4 — `app/routers/signatures.py`: `POST /api/v1/signatures` con decorator `@limiter.limit("5/minute")` de slowapi (R4)
- [ ] T5 — Extracción de IP: `CF-Connecting-IP` → `X-Forwarded-For` → `request.client.host` (R5)
- [ ] T6 — Clave Redis rate limiting: `petition:rl:sign:{compute_hmac(ip)}` (R6)
- [ ] T7 — Respuesta 429 con `retry_after` en segundos (R7)
- [ ] T8 — Llamar `verify_cedula(cedula)` desde `app/crypto.py`; retornar 422 si falla (R8, R9)
- [ ] T9 — Normalizar email a lowercase strip; calcular `email_hash = compute_hmac(email_normalized)` (R10, R11)
- [ ] T10 — INSERT en `signatures` con `email_hash`; capturar `UniqueViolationError` del índice parcial → 409 (R12, R13)

## Servicio de firma

- [ ] T11 — `app/services/signature_service.py`: `create_signature(db, campaign_id, data, ip_hmac)` — persiste `Signature` + `Consent` en una transacción (R14)
- [ ] T12 — `Consent` creado con `text_snapshot` = aviso vigente de la campaña (`privacy_config.aviso_privacidad`), `version` = `privacy_config.version`, `ip_hmac` (R14)

## Registrar en main.py

- [ ] T13 — Registrar `router signatures` en `app/main.py` con prefijo `/api/v1`

## Verificación

- [ ] T14 — `POST /api/v1/signatures` con token Turnstile test → 201 Created
- [ ] T15 — Segunda firma con mismo email en misma campaña → 409
- [ ] T16 — Cédula inválida (ej. `1234567890`) → 422
- [ ] T17 — Sexta request desde misma IP en < 60s → 429
