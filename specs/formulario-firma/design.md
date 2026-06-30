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
