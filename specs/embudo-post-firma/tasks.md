# Tasks — embudo-post-firma

> No implementar hasta que el usuario apruebe esta spec (sdd:true).
> Antes de `in_progress`: resolver los puntos abiertos marcados 🔷.

## Decisiones resueltas (sesión 37)

- ✅ **Aviso de privacidad**: cubre la finalidad. Además se **renombra la
  denominación de cara al usuario de "novedades" → "Anuncios"** (el campo
  interno `notify_updates` no cambia; es un cambio de copy/terminología de
  producto, consistente con `centro-comunicaciones`).
- ✅ **Autorización**: **token efímero dedicado** (`newsletter_token` devuelto
  al crear la firma) — ver design §Autorización para las implicaciones.
- ✅ **Micro-feedback**: se diseña con el sistema ya definido → frame en
  `design-export.html` (creado en esta sesión).
- ✅ **Orden de migración**: `embudo-post-firma` va **primera → 036** (antes de
  `config-email-org` 038 y `centro-comunicaciones` 039+). No comparte tablas con
  ninguna otra; sin conflicto.

## Backend — IMPLEMENTADO (sesión 37)

- [x] Migración `036`: `signatures.newsletter_token` +
  `newsletter_token_expires_at` (índice único parcial); `consents.notify_updates_at`
  (R5, R11). Verificada upgrade/downgrade/upgrade.
- [x] `signature_service.create_signature`: genera `newsletter_token` (uuid4 hex,
  exp ~2 h, `_NEWSLETTER_TOKEN_TTL_HOURS`) y lo asigna al Signature (R5).
- [x] Respuesta de creación += `newsletter_token` (R5).
- [x] `set_newsletter_consent(db, token, notify_updates)` + endpoint
  `PATCH /v1/public-campaign/signatures/newsletter-consent`: valida token
  (ligado a la firma, no expirado), set `notify_updates` + `notify_updates_at`;
  idempotente; rate-limited 10/min; 204/404 sin PII (R1, R2, R6, R7, R11).
- [x] Verificado que NO altera `status` de la firma (R8) — e2e HTTP: status
  sigue `pending_confirmation` tras el PATCH.
- [x] **Fix latente**: migración `037` corrige la policy RLS de `arco_requests`
  (guard `NULLIF`, misma regresión que 021/031 arreglaron en consents) — el
  nuevo flujo dejaba `current_org_id=''` en la conexión y rompía consultas de
  arco_requests.

## Frontend — IMPLEMENTADO (sesión 37)

- [x] `signatures-api.ts`: `SignatureResult.newsletter_token`;
  `setNewsletterConsent(token, val)` → `{ ok, expired }` (distingue red vs 404).
- [x] `SignFlow.tsx`: guarda `newsletter_token`; `onSubscribe` real con manejo
  de error (R1, R2).
- [x] `StepThanks.tsx`: checkbox controlado + feedback de los 5 estados y
  reversión visual ante fallo/expirado (R10); renombre a **Anuncios**.
- [x] `tsc --noEmit` limpio. (Se dejó `subscribe_newsletter: false` en el submit
  — vestigial, inocuo; su limpieza es fuera de alcance por la spec.)

## Tests — IMPLEMENTADO (sesión 37)

- [x] `test_embudo_post_firma.py`: activa (notify_updates=True + notify_updates_at,
  R1/R11); desactiva + idempotencia (R2/R7); token inválido (R5/R6); token
  expirado. **4 passed**; suite completa **153 passed**.
- [ ] (Opcional) Regresión explícita de que `pending_confirmation` no entra en
  `get_signer_emails_for_notify` — ya garantizado por el filtro existente
  (`status=confirmed`), no relajado por esta feature (R8).

## Cierre

- [x] Verificación e2e HTTP real en dev (crear firma → PATCH activar/desactivar
  → token inválido → efecto en DB con contexto RLS).
- [ ] Verificación visual en navegador del micro-feedback (pendiente del usuario).
- [ ] Trazabilidad R1..R11 ↔ código ↔ tests (Reviewer).
- [ ] El usuario decide el estado final `done`.
