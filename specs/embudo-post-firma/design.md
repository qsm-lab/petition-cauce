# Design — embudo-post-firma

## Estado actual (lo ya existente)

- **Frontend**: `StepThanks.tsx` (paso 4 de `SignFlow`) renderiza el CTA de
  compartir (funcional) y un checkbox de novedades (roto). `SignFlow.tsx:236`
  pasa `onSubscribe={() => {}}` y el submit inicial manda
  `subscribe_newsletter: false` hardcodeado (`SignFlow.tsx:130`).
- **Backend**: `Consent.notify_updates` (operativo, filtra envíos) y
  `Consent.subscribe_newsletter` (vestigial). La creación de firma
  (`signature_service.create`) inserta el `Consent` y ya genera un
  `arco_review_token`. La respuesta `SignatureCreated` devuelve solo
  `{id, status}`.
- **Revocación**: el portal ARCO (`CampaignCard`) ya togglea `notify_updates`.

## Enfoque elegido

Persistir el consentimiento de novedades en `notify_updates` mediante un
**endpoint público autorizado por un token efímero devuelto en la creación de
la firma**. Alineado con el intent de la feature (consentimiento *post-firma*,
separado del acto de firmar) y sin exponer al cliente ningún token de acceso
amplio.

### Flujo

```
1. StepForm submit → POST /v1/campaigns/{id}/signatures
   → crea Signature (pending_confirmation) + Consent
   → respuesta: { id, status, newsletter_token }   ← NUEVO campo
2. StepThanks (paso 4): usuario marca/desmarca "Quiero recibir noticias"
   → PATCH /v1/signatures/newsletter-consent
      body: { token: <newsletter_token>, notify_updates: <bool> }
   → valida token (ligado a signature_id, no expirado, corta vida)
   → set Consent.notify_updates = <bool>  (+ notify_updates_at, R11)
   → 204 / { ok: true }
3. Novedades reales (fuera de alcance) filtran por notify_updates=true
   AND status=confirmed AND archived_at IS NULL  ← sin cambios (R8)
```

### Alternativas descartadas

- **Autorizar solo con `signature_id`** (UUID no adivinable, sin token): más
  simple, pero un tercero que conociera el id podría alterar el consentimiento;
  el token efímero es marginalmente más costoso y cierra el hueco. Se documenta
  como fallback aceptable si se decide minimizar cambios de schema.
- **Mover el checkbox al `StepForm`** y mandarlo en el payload inicial: rompe
  el intent "post-firma" y mezcla el consentimiento de novedades con el acto de
  firma (lo contrario a "no empaquetado"). Descartado.
- **Exponer el `arco_review_token` al cliente**: da acceso a **todo** el portal
  ARCO del titular; jamás debe viajar al cliente en este flujo. Descartado.

## Decisión sobre el token efímero (R5) — ELEGIDO: token dedicado (sesión 37)

**Implicaciones de las dos opciones:**

| | Token dedicado (elegido) | Solo `signature_id` |
|---|---|---|
| Seguridad | Solo quien creó la firma (tiene el token en su sesión) togglea el consentimiento; un tercero con el UUID no puede | El UUID v4 es no adivinable pero **no es un secreto de autorización** (aparece en logs/URLs); control débil para un dato de consentimiento LOPDP |
| Complejidad | +1 columna en `signatures` + cambio de response + generación en `create` | Mínima: sin columna, el `id` ya viaja en la response |
| Caducidad | Corta vida (~2 h); si expira, la UI degrada a "activá desde el enlace de tu correo" | El `id` no caduca nunca |
| Blast radius si se filtra | Bajo y acotado (solo togglea anuncios de esa firma) y caduca | Bajo pero **sin caducidad**: cualquiera con el id cambia el consentimiento |

**Elegido: token dedicado** — el consentimiento es un dato LOPDP y merece una
autorización real, no un UUID tratado como secreto. Costo bajo (1 columna, ya
hay patrón `confirmation_token`/`arco_review_token`) y habilita caducidad +
degradación limpia. Implementación: hex de `uuid4` en `signatures.newsletter_token`
(nullable) + `newsletter_token_expires_at` (~2 h). NO un JWT nuevo.

## Decisión sobre trazabilidad (R11)

`notify_updates` se fija después de crear la fila `consent`, que solo tiene
`consented_at`/`created_at` del alta. Opciones:
- **(a) Columna `notify_updates_at` en `consents`** (nullable, timestamptz) —
  registra el momento del opt-in/opt-off. Simple, suficiente para auditar
  "cuándo consintió novedades". **Recomendada.**
- (b) Anotar en la auditoría ARCO existente — pero este canal no es ARCO;
  forzarlo ensucia esa tabla.

## Archivos afectados

### Backend
- `apps/api/app/models/signature.py` — `newsletter_token`,
  `newsletter_token_expires_at` (mig. nueva).
- `apps/api/app/models/consent.py` — `notify_updates_at` (mig. nueva, R11).
- **Migración Alembic nueva** — head actual `035`; esta es la **036** (primera
  de la cadena de sesión 37: `036` embudo → `037` fix-RLS-arco → `038` config-email-org → `039+`
  centro). No comparte tablas con las otras; head lineal, sin merge.
- `apps/api/app/schemas/signature.py` — `SignatureCreated` += `newsletter_token`.
- `apps/api/app/schemas/*` — schema del PATCH de consentimiento.
- `apps/api/app/services/signature_service.py` — generar `newsletter_token` en
  `create`; devolverlo.
- `apps/api/app/services/consent_service.py` (o extensión de
  `signature_service`) — validar token + set `notify_updates` + `notify_updates_at`.
- `apps/api/app/routers/public_campaign.py` — endpoint `PATCH
  /v1/signatures/newsletter-consent` (público, rate-limited).

### Frontend
- `apps/web/src/lib/signatures-api.ts` — tipar `newsletter_token` en la
  respuesta; función `setNewsletterConsent(token, value)`.
- `apps/web/src/components/sign-flow/SignFlow.tsx` — guardar `newsletter_token`
  del resultado; implementar `onSubscribe` real (llama al lib, maneja error).
- `apps/web/src/components/sign-flow/StepThanks.tsx` — feedback de estado
  (R10); sin rediseño (checkbox ya existe).

## Seguridad

- Endpoint público → Turnstile no aplica (no es un alta), pero **sí** rate
  limiting por IP con HMAC (R6). Respuesta genérica, sin PII (R6).
- Token de un solo propósito y corta vida (R5); no reutilizable para acceso al
  portal ni para confirmar la firma.
- El PATCH no confirma la firma ni cambia su `status` — solo toca
  `notify_updates` (evita convertir este canal en un bypass del doble opt-in).

## LOPDP

- **Rol**: Encargado (la organización cliente es Responsable).
- **Base de legitimación**: **consentimiento** del titular, **independiente** de
  la base que legitima el tratamiento de la firma. No premarcado (R3), explícito
  y granular por campaña (el `Consent` es por firma/campaña).
- **Finalidad**: envío de novedades del trámite de esa campaña — distinta y
  separada de la finalidad de recolección/entrega de la firma.
- **Dato tratado**: el email ya recolectado para la firma; esta feature **no**
  recolecta datos nuevos, solo habilita una finalidad adicional bajo
  consentimiento.
- **Revocación**: ya disponible vía portal ARCO (`notify_updates`, R8 de
  derechos-arco) y, a futuro, vía desuscripción en el pie del email
  (`email-cumplimiento-masivo`). No se crea un flag nuevo (R9).
- **Trazabilidad**: `notify_updates_at` registra el momento del consentimiento
  (R11). El `text_snapshot`/`version`/`legal_basis` del `Consent` documentan el
  marco; conviene que el copy del checkbox quede reflejado como texto del
  consentimiento de novedades (decisión de implementación: ¿se versiona el copy
  del opt-in de novedades? Para MVP, basta el timestamp + el copy fijo en UI).
- **`privacy_config`**: no requiere campos nuevos por campaña — la finalidad
  (Anuncios de la campaña) ya está contemplada en el aviso de privacidad base
  (confirmado, sesión 37).

## Flujo de diseño (regla del proyecto)

El checkbox y el CTA de compartir ya existen en `StepThanks`; el único cambio
visual es el **micro-feedback de estado** (R10) y el renombre a "Anuncios".
**Resuelto (sesión 37)**: se diseña con el sistema ya definido → estados del
checkbox en `design-export.html` (default / activado con confirmación /
desactivado / error de red / token expirado). Calca los tokens del sistema
(Work Sans, lime, muted), sin pantalla nueva.

## Dependencias / orden

- **Migración**: **036** — primera de la cadena de sesión 37
  (`036` embudo → `038` config-email-org → `039+` centro). No comparte tablas;
  head lineal, sin merge.
- No depende de `novedades-campana`/`centro-comunicaciones` para capturar el
  consentimiento, pero el consentimiento (Anuncios) no tiene efecto observable
  hasta que exista el envío (esas features).
