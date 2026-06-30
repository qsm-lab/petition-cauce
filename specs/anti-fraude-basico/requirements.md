# Requisitos — anti-fraude-basico
> EARS notation. Fecha: 2026-06-30

---

## Cloudflare Turnstile

**R1** — El formulario de firma SHALL incluir un token Turnstile Non-interactive (widget invisible) que se adjunta automáticamente al payload del POST `/api/v1/signatures`.

**R2** — El backend SHALL verificar el token Turnstile contra la API de Cloudflare (`https://challenges.cloudflare.com/turnstile/v0/siteverify`) antes de procesar la firma. Si la verificación falla, SHALL retornar HTTP 422 con `{ "error": "turnstile_failed" }`.

**R3** — En entorno `development`, WHEN `TURNSTILE_SECRET_KEY` es la clave de test oficial de Cloudflare (`1x0000000000000000000000000000000AA`), la verificación SHALL siempre pasar sin llamada real a Cloudflare.

---

## Rate limiting por IP

**R4** — El endpoint `POST /api/v1/signatures` SHALL aplicar rate limiting de **5 requests por IP por minuto** usando slowapi + Redis.

**R5** — La IP usada para rate limiting SHALL ser el valor del header `CF-Connecting-IP` si está disponible (entorno de producción detrás de Cloudflare), o `X-Forwarded-For` en su defecto, o la IP directa de la conexión.

**R6** — La clave Redis para rate limiting SHALL ser `petition:rl:sign:{ip_hmac}` donde `ip_hmac = hmac_sha256(ip, HMAC_SECRET_KEY)`. Nunca se almacena la IP en claro.

**R7** — WHEN el rate limit es excedido, el sistema SHALL retornar HTTP 429 con `{ "error": "rate_limit_exceeded", "retry_after": N }` donde N es el número de segundos hasta el próximo slot.

---

## Validación de formato de cédula

**R8** — El backend SHALL validar que el campo `cedula` enviado en el formulario de firma: (a) tenga exactamente 10 dígitos, (b) sea numérico, (c) tenga los primeros 2 dígitos entre `01` y `24` o iguales a `30`, (d) el tercer dígito sea menor a `6`, (e) supere el algoritmo módulo-10 (dígito verificador). La función `verify_cedula()` en `app/crypto.py` ya implementa (a–e).

**R9** — WHEN la cédula no supera la validación, el sistema SHALL retornar HTTP 422 con `{ "field": "cedula", "error": "cedula_invalida" }` antes de cualquier operación de escritura en BD.

---

## Deduplicación por email (misma campaña)

**R10** — El sistema SHALL prevenir que un mismo email firme más de una vez la misma campaña. La comparación se hará sobre `email_hash` (HMAC-SHA256 del email normalizado en minúsculas) usando los índices únicos parciales ya creados en migración 006.

**R11** — La normalización del email SHALL ser: convertir a minúsculas, eliminar espacios al inicio y al final. No se eliminarán aliases de Gmail (`+tag`) en esta fase.

**R12** — WHEN el email_hash ya existe para la misma campaña (el INSERT viola el índice único parcial), el sistema SHALL retornar HTTP 409 con `{ "error": "ya_firmaste", "campaign_id": "..." }`.

**R13** — WHEN el signer_type de la campaña es `'natural'` o `'both'`, el índice único SHALL ser `uq_sig_natural_{campaign_id}` sobre `(campaign_id, email_hash)` WHERE `signer_type = 'natural'`. WHEN es `'org'` o `'both'`, el índice SHALL ser `uq_sig_org_{campaign_id}` sobre `(campaign_id, email_hash)` WHERE `signer_type = 'org'`. (Estos índices ya existen desde migración 006.)

---

## Orden de validaciones en el endpoint POST /signatures

**R14** — El sistema SHALL ejecutar las validaciones en este orden, retornando al primer fallo sin continuar:
1. Validación de schema Pydantic (campos obligatorios, tipos)
2. Verificación Turnstile (R2)
3. Rate limiting por IP (R4–R7)
4. Validación de cédula (R8–R9)
5. Chequeo de deduplicación por email (R10–R13)
6. INSERT en `signatures` + `consents`
