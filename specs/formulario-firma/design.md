# Diseño técnico — formulario-firma
> Fecha: 2026-06-30
> Diseño de referencia: plan/design/design_handoff_cauce_front/SignFlow.dc.html

---

## Privacy config aprobada

Esta feature trata PII (nombre, email, cédula, provincia). La `privacy_config` para la campaña dev
está pre-generada por el seed con `render_aviso_privacidad()`. El aviso está disponible en
`GET /api/v1/campaigns/{campaign_id}/privacy` para enlazarlo desde el formulario.

El campo `consent.text_snapshot` registra el texto exacto del aviso vigente al momento de firmar.
El campo `consent.version` registra la versión del aviso (`privacy_config.version`).

---

## Archivos afectados

### Next.js (apps/web)
- `components/sign-flow/SignFlow.tsx` — componente cliente, máquina de estados 0–4
- `components/sign-flow/StepForm.tsx` — Estado 0: campos + visibilidad + consentimiento
- `components/sign-flow/StepSending.tsx` — Estado 1: spinner
- `components/sign-flow/StepSuccess.tsx` — Estado 2: check email
- `components/sign-flow/StepError.tsx` — Estado 3: error + retry
- `components/sign-flow/StepThanks.tsx` — Estado 4: thank you + newsletter
- `lib/signatures-api.ts` — `submitSignature()`, `resendConfirmation()`

### API (FastAPI)
- `app/routers/signatures.py` — `POST /api/v1/signatures` (anti-fraude-basico T4–T12)
- `app/routers/signatures.py` — `GET /api/v1/signatures/confirm/{token}`
- `app/routers/campaigns.py` — `GET /api/v1/campaigns/{campaign_id}/privacy` (retorna aviso vigente)

---

## Decisiones de diseño

**D1 — Máquina de estados explícita, no wizard de rutas.**
Los 5 estados (0–4) son un `step: number` en el estado local del componente `SignFlow.tsx`.
No hay rutas de URL distintas para cada paso. El estado no se persiste entre recargas.

**D2 — Turnstile widget incluido en StepForm.**
El token Turnstile se genera automáticamente (Non-interactive) al montar el componente.
Se adjunta al payload del POST. La lib de Turnstile (`@cloudflare/turnstile`) se carga
de forma lazy solo cuando el modal abre.

**D3 — Bottom sheet en mobile, modal en desktop.**
El componente usa `useMediaQuery('(min-width: 768px)')` para decidir el tipo de contenedor.
Un solo componente, dos presentaciones CSS distintas mediante clases condicionales.

**D4 — Focus trap con `focus-trap-react` o implementación manual.**
El README requiere focus trap en producción. Se usará `focus-trap-react` (librería ligera,
sin dependencias pesadas). Se activa al montar el modal y se desactiva al cerrar.

**D5 — Datos del formulario preservados en Estado 3 (Error).**
Si el usuario elige "Volver al formulario", vuelve al Estado 0 con `name`, `email`, `cedula`,
`provincia`, `vis`, `consent` preservados. Solo el token Turnstile se regenera.

**D6 — Contador en Estado 4 viene del response del endpoint de confirmación.**
`GET /confirm/{token}` retorna el contador actualizado `{ count, goal }`. El chip en Estado 4
muestra estos valores. No se hace polling; es una lectura única.

**D7 — Email en Fase 1: log en consola en dev.**
La activación de Resend (`resend_api_key` configurado) habilita el envío real.
En dev, el `confirmation_token` se loguea en el output de la API para que el dev pueda
confirmar manualmente con `GET /api/v1/signatures/confirm/{token}`.

---

## Seguridad

- El payload del POST nunca envía el email en texto plano; el backend lo cifra/hashea antes de persistir.
- El `confirmation_token` tiene TTL de 24h (marcar expirado si no se confirma en ese plazo).
- El botón "Firmar" está desactivado sin consentimiento; la validación también ocurre en backend.
- No se expone `cedula` ni `email` en ningún response de la API.

---

## LOPDP

- **Base de legitimación:** consentimiento expreso (Art. 7.1 LOPDP). Checkbox NO pre-marcado.
- **Registro de consentimiento:** `consents.text_snapshot` + `consents.version` + `consents.ip_hmac` + `consents.legal_basis = 'consentimiento_expreso'`.
- **Visibilidad por defecto:** anónima. La opción "pública" requiere acción explícita del usuario.
- **Newsletter:** consentimiento separado e independiente (Art. 7 — no empaquetado).
- **Enlace al aviso:** obligatorio en el checkbox (Art. 13 LOPDP — aviso de privacidad).

---

## Addendum — Iteración 2026-07-01

### Archivos modificados (adicionales a los ya implementados)

**API:**
- `apps/api/migrations/versions/010_add_country_to_signatures.py` — nueva columna `country`
- `apps/api/app/schemas/signature.py` — agregar `signer_type`, `org_name`, `country`, `location_mode`
- `apps/api/app/services/signature_service.py` — persistir los nuevos campos; validar `required_fields`
- `apps/api/app/routers/public_campaign.py` — `_serialize()`: extraer `form_config` de `meta` y exponerlo explícitamente
- `apps/api/app/scripts/seed_dev.py` — agregar `meta.form_config` a la campaña dev

**Next.js:**
- `apps/web/src/lib/campaign-api.ts` — agregar `form_config` a `PublicCampaign`
- `apps/web/src/app/(campaign)/components/ActionBlock.tsx` — pasar `form_config` al SignFlow
- `apps/web/src/components/sign-flow/SignFlow.tsx` — extender `SignFlowState` con nuevos campos
- `apps/web/src/components/sign-flow/StepForm.tsx` — nueva sección signer_type + ubicación + visibilidad filtrada
- `apps/web/src/lib/signatures-api.ts` — incluir nuevos campos en el payload POST

### Decisiones nuevas

**D8 — `form_config` en `campaign.meta` JSONB, sin migración.**
El modelo ya tiene `meta JSONB`. Los defaults se calculan en `_serialize()` si la clave no existe.
La campaña dev en el seed se actualiza para incluir `meta["form_config"]` de ejemplo con todos los modos habilitados (`signer_types: ["natural", "org"]`, `location_modes: ["nacional", "internacional"]`, `visibility_options: ["publica", "anonima", "secreta"]`).

**D9 — Migration 010: columna `country` (nullable) en `signatures`.**
Separar `provincia` y `country` evita mezclar semánticas en el mismo campo.
Inferencia: `country IS NOT NULL → internacional`, `provincia IS NOT NULL → nacional`.

**D10 — `signer_type` en `Signature` deja de estar hardcodeado a "natural".**
`signature_service.create_signature()` usa el valor del payload (`data.signer_type`).
`org_name` se persiste solo si `signer_type = "org"` (y se hashea en `org_name_hash` como el email).

**D11 — `cedula` obligatoria condicionalmente.**
El validator de Pydantic solo exige cédula si el campo está en `required_fields` del `form_config`.
Para no romper el flujo actual (donde `cedula` siempre se valida), se lee `form_config` del campaign en el endpoint antes de pasar a `create_signature()`. Si `"cedula"` no está en `required_fields`, se omite la validación del dígito verificador.

**D12 — Visibilidad: `form_config.visibility_options` como lista de strings DB.**
Valores permitidos: `"publica"`, `"anonima"`, `"secreta"`. El frontend normaliza los shortcuts (`pub`→`publica`) igual que hoy. La validación Pydantic solo acepta los valores en la lista del `form_config`.

### LOPDP — Addendum

- **Firmantes internacionales sin cédula:** la base legal sigue siendo consentimiento expreso. Sin cédula, la deduplicación opera solo por `email_hash`. Se acepta como limitación de Fase 1.
- **Nombre de organización:** se trata como dato del firmante (persona que representa a la org), no dato de la org. Se hashea en `org_name_hash` para deduplicación futura. No se cifra en Fase 1 (igual que `name`).
- **Visibilidad restringida por defecto:** quitar "Secreta" del default protege la reputación del resultado visible de la campaña (menos incentivo para firmas secretas no contables).
