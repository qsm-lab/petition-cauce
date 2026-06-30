# Diseño técnico — anti-fraude-basico
> Fecha: 2026-06-30

---

## Archivos afectados

### API (FastAPI)
- `app/routers/signatures.py` — `POST /api/v1/signatures` con todas las validaciones
- `app/services/turnstile_service.py` — verificación Turnstile contra API CF
- `app/services/signature_service.py` — lógica de deduplicación, INSERT signatures + consents
- `app/schemas/signature.py` — schema Pydantic de entrada
- `app/crypto.py` — `verify_cedula()` y `compute_hmac()` ya implementados
- `app/config.py` — `turnstile_site_key`, `turnstile_secret_key` ya presentes

### Next.js (apps/web)
- `components/sign-flow/SignFlow.tsx` — incluye widget Turnstile (ver feature `formulario-firma`)

---

## Decisiones de diseño

**D1 — Turnstile Non-interactive (no Managed).**
El widget Managed puede fallar en cadena en zonas con conectividad degradada. Non-interactive es silencioso; el usuario nunca ve un challenge. Heredado de proy_forms-qsm.

**D2 — HMAC de IP para rate limiting.**
No almacenamos la IP en claro en Redis ni en logs. `hmac_sha256(ip, HMAC_SECRET_KEY)` actúa como pseudónimo determinístico: permite comparar sin exponer. Cumple LOPDP (dato pseudonimizado).

**D3 — email_hash en lugar de email normalizado.**
Los índices únicos parciales de migración 006 usan `email_hash`. La deduplicación nunca requiere descifrar el email; opera sobre el hash. Esto evita que un operador pueda enumerar emails desde la BD.

**D4 — No se elimina alias `+tag` de Gmail en Fase 1.**
Sería más robusto eliminar `+tag` y los puntos de Gmail para deduplicar. Se pospone a `deduplicacion-robusta` (Fase 4). En Fase 1 la validación básica cubre el caso común.

**D5 — Cédula: validación solo de formato en Fase 1.**
`verify_cedula()` ya implementa el algoritmo módulo-10 completo (Fase 4 la llamaba "validación completa" en el feature_list pero el algoritmo ya estaba en crypto.py desde modelo-base). Esta feature lo integra en el endpoint. En Fase 4 se añadirá consulta contra registro civil si hay acuerdo API.

**D6 — Orden de validaciones determinístico.**
El orden R14 minimiza llamadas a servicios externos: Turnstile se llama antes del rate limit para no contar bots en el limite de usuarios legítimos. La cédula se valida antes del INSERT para evitar escrituras inválidas.

---

## Seguridad

- Turnstile secret nunca se expone al frontend; la verificación es server-side.
- Rate limit por IP HMAC evita enumeración de IPs reales.
- El 409 en deduplicación no revela qué email ya firmó; solo confirma que la campaña ya tiene esa firma.
- Todos los errores retornan mensajes genéricos sin stack trace en producción (`DEBUG=false`).

---

## Implicaciones LOPDP

- La IP se trata pseudonimizada desde el primer contacto con el sistema (R6).
- El consentimiento se registra en `consents` con `ip_hmac` (no ip_plain), conforme al modelo-base.
- No hay nuevos campos de PII en esta feature.
