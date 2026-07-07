# Tasks — formulario-firma + firma-visibilidad
> Referencia: requirements.md R1–R25

---

## API — endpoints

- [x] T1 — `app/routers/campaigns.py`: `GET /api/v1/campaigns/{campaign_id}/privacy` — retorna `{ aviso_privacidad, version, base_legal, data_contact_email }` desde `privacy_config` (R11)
- [x] T2 — `app/routers/signatures.py`: `GET /api/v1/signatures/confirm/{token}` — confirma firma, actualiza `status='confirmada'`, retorna `{ count, goal }` (R20)
- [x] T3 — En dev: loguear `confirmation_token` en consola al crear firma (D7)

## Componente SignFlow

- [x] T4 — `components/sign-flow/SignFlow.tsx`: state machine `step 0–4`, `SignFlowState` interface; backdrop con blur; bottom sheet mobile / modal desktop (R1–R4, D1, D3)
- [x] T5 — Focus trap al abrir; desactivar al cerrar; Esc cierra el modal (R3, R4, D4)
- [x] T6 — `role="dialog"`, `aria-modal="true"`, `aria-label` (R4)

## Estado 0 — Form

- [x] T7 — `StepForm.tsx`: campos `nombre`, `email`, `cedula` (inputmode numeric), `provincia` (select) con labels asociados y estilo según README (R5, R6, R7)
- [x] T8 — Radio group visibilidad Pública/Anónima/Secreta con default Anónima; `role="radiogroup"` + `role="radio"` + `aria-checked`; descripción contextual dinámica (R8, R9, R10)
- [x] T9 — Checkbox consentimiento NO pre-marcado, con enlace a `/aviso-de-privacidad`, borde cambia a `--bp` al marcar (R11)
- [x] T10 — Botón "Firmar la petición" desactivado sin consentimiento; estilos activo/desactivado según README (R12)
- [x] T11 — Nota de pie: "Verificación anti-bot invisible · doble confirmación por correo" (R13)
- [x] T12 — Widget Turnstile Non-interactive montado en este estado; token en state (D2)

## Estados 1, 2, 3, 4

- [x] T13 — `StepSending.tsx`: spinner 52px border-animation, título, `aria-busy="true"` (R15, R23)
- [x] T14 — `lib/signatures-api.ts`: `submitSignature(payload)` — POST con token Turnstile, manejo 201/409/422/429 (R15)
- [x] T15 — `StepSuccess.tsx`: email en bold, CTA "Ya confirmé → continuar" → step 4, botón reenvío; `aria-live="polite"` (R16, R23)
- [x] T16 — `StepError.tsx`: icono ⚠ rojo, botón Reintentar (re-submit) y Volver (step 0 con datos preservados); `aria-live="assertive"` (R17, R23)
- [x] T17 — `StepThanks.tsx`: icono ✓, "¡Gracias, [nombre]!", chip contador `N de M`; fila share; checkbox newsletter (no pre-marcado); `aria-live="polite"` (R18, R22)

## Accesibilidad y motion

- [x] T18 — `min-height / min-width: 44px` en todos los interactivos (R24)
- [x] T19 — Todas las animaciones con fallback `prefers-reduced-motion: reduce` (R25, R21)

## Verificación

- [x] T20 — Abrir Sign Flow desde landing → modal/bottom-sheet en desktop/mobile
- [x] T21 — Consentimiento no marcado → botón desactivado
- [x] T22 — Submit con datos válidos → Estado 1 → Estado 2
- [x] T23 — `confirmation_token` visible en logs de la API en dev
- [x] T24 — GET /confirm/{token} → `status='confirmada'`, retorna `{count, goal}` → Estado 4 con contador
- [x] T25 — Submit duplicado (mismo email, misma campaña) → Estado 3 con mensaje claro
- [x] T26 — Cédula inválida → error 422 → Estado 3
- [x] T27 — Esc cierra el modal; foco vuelve al botón CTA de la landing

---

## Addendum — Iteración 2026-07-01 (R26–R40, D8–D12)

### API — migración y schema

- [x] T28 — `migrations/versions/010_add_country_to_signatures.py`: ADD COLUMN `country VARCHAR(100)` nullable en `signatures` (D9)
- [x] T29 — `schemas/signature.py`: agregar campos opcionales `signer_type: Literal['natural','org'] = 'natural'`, `org_name: str | None = None`, `location_mode: Literal['nacional','internacional'] = 'nacional'`, `country: str | None = None` (R31, R35)

### API — servicio y router

- [x] T30 — `services/signature_service.py`: usar `data.signer_type` en lugar de hardcode `"natural"`; persistir `org_name` (y calcular `org_name_hash` con HMAC); persistir `country` si `location_mode = 'internacional'` (D10)
- [x] T31 — `services/signature_service.py`: validar campos requeridos contra `required_fields` del `form_config` de la campaña antes de insertar; omitir validación de cédula si `"cedula"` no está en `required_fields` (R27, D11)
- [x] T32 — `routers/public_campaign.py` → `_serialize()`: extraer `form_config` de `campaign.meta` y añadirlo como clave de primer nivel en el response; aplicar defaults si falta alguna clave (R26)
- [x] T33 — `scripts/seed_dev.py`: agregar `meta={"form_config": {"signer_types": ["natural","org"], "location_modes": ["nacional","internacional"], "required_fields": ["nombre","email","cedula","location"], "visibility_options": ["publica","anonima","secreta"]}}` a la campaña dev (D8)

### Frontend — types y state

- [x] T34 — `lib/campaign-api.ts`: agregar `form_config: FormConfig` a `PublicCampaign` con la interfaz `FormConfig { signer_types, location_modes, required_fields, visibility_options }` (R26)
- [x] T35 — `components/sign-flow/SignFlow.tsx`: extender `SignFlowState` con `signer_type`, `org_name`, `location_mode`, `country`; actualizar state inicial y el payload enviado en Estado 1 (R31, R35)

### Frontend — StepForm

- [x] T36 — `StepForm.tsx`: agregar sección toggle **Persona natural / Organización** antes del campo Nombre; mostrar solo si `form_config.signer_types.length > 1` (R28–R29)
- [x] T37 — `StepForm.tsx`: campo **Nombre de la organización** condicional bajo el toggle; `required` si `"org_name"` en `required_fields` (R30)
- [x] T38 — `StepForm.tsx`: agregar toggle **Nacional / Internacional** (radio-style con checkmark) antes del campo de ubicación; mostrar solo si `form_config.location_modes.length > 1` (R32–R33)
- [x] T39 — `StepForm.tsx`: renderizar select de provincia si `location_mode = 'nacional'` (actual); renderizar campo texto País si `location_mode = 'internacional'` (R34–R35)
- [x] T40 — `StepForm.tsx`: campo cédula — `required` condicionalmente según `"cedula"` en `required_fields` del `form_config` (R36)
- [x] T41 — `StepForm.tsx`: radio group visibilidad — filtrar `VIS_OPTIONS` a solo las incluidas en `form_config.visibility_options`; ocultar grupo si solo hay una opción y aplicarla automáticamente (R37–R40)
- [x] T42 — `lib/signatures-api.ts`: incluir `signer_type`, `org_name`, `location_mode`, `country` en el payload del POST (R31, R35)

### Verificación addendum

- [x] T43 — Con `signer_types: ["natural"]` → toggle tipo invisible; formulario igual que hoy
- [x] T44 — Con `signer_types: ["natural","org"]` → toggle visible; elegir "Organización" → campo org_name aparece; submit guarda `signer_type="org"` y `org_name` en DB
- [x] T45 — Con `location_modes: ["nacional","internacional"]` → toggle ubicación visible; elegir "Internacional" → campo País aparece, provincia desaparece
- [x] T46 — Con `visibility_options: ["publica","anonima"]` → botón "Secreta" no aparece
- [x] T47 — Con `visibility_options: ["publica","anonima","secreta"]` → los tres botones aparecen
- [x] T48 — Campaña con `"cedula"` fuera de `required_fields` → cédula no es requerida; firmante internacional puede enviar sin cédula
- [x] T49 — Migration 010 aplica sin errores (`alembic upgrade head`)
