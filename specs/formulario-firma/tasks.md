# Tasks — formulario-firma + firma-visibilidad
> Referencia: requirements.md R1–R25

---

## API — endpoints

- [ ] T1 — `app/routers/campaigns.py`: `GET /api/v1/campaigns/{campaign_id}/privacy` — retorna `{ aviso_privacidad, version, base_legal, data_contact_email }` desde `privacy_config` (R11)
- [ ] T2 — `app/routers/signatures.py`: `GET /api/v1/signatures/confirm/{token}` — confirma firma, actualiza `status='confirmada'`, retorna `{ count, goal }` (R20)
- [ ] T3 — En dev: loguear `confirmation_token` en consola al crear firma (D7)

## Componente SignFlow

- [ ] T4 — `components/sign-flow/SignFlow.tsx`: state machine `step 0–4`, `SignFlowState` interface; backdrop con blur; bottom sheet mobile / modal desktop (R1–R4, D1, D3)
- [ ] T5 — Focus trap al abrir; desactivar al cerrar; Esc cierra el modal (R3, R4, D4)
- [ ] T6 — `role="dialog"`, `aria-modal="true"`, `aria-label` (R4)

## Estado 0 — Form

- [ ] T7 — `StepForm.tsx`: campos `nombre`, `email`, `cedula` (inputmode numeric), `provincia` (select) con labels asociados y estilo según README (R5, R6, R7)
- [ ] T8 — Radio group visibilidad Pública/Anónima/Secreta con default Anónima; `role="radiogroup"` + `role="radio"` + `aria-checked`; descripción contextual dinámica (R8, R9, R10)
- [ ] T9 — Checkbox consentimiento NO pre-marcado, con enlace a `/aviso-de-privacidad`, borde cambia a `--bp` al marcar (R11)
- [ ] T10 — Botón "Firmar la petición" desactivado sin consentimiento; estilos activo/desactivado según README (R12)
- [ ] T11 — Nota de pie: "Verificación anti-bot invisible · doble confirmación por correo" (R13)
- [ ] T12 — Widget Turnstile Non-interactive montado en este estado; token en state (D2)

## Estados 1, 2, 3, 4

- [ ] T13 — `StepSending.tsx`: spinner 52px border-animation, título, `aria-busy="true"` (R15, R23)
- [ ] T14 — `lib/signatures-api.ts`: `submitSignature(payload)` — POST con token Turnstile, manejo 201/409/422/429 (R15)
- [ ] T15 — `StepSuccess.tsx`: email en bold, CTA "Ya confirmé → continuar" → step 4, botón reenvío; `aria-live="polite"` (R16, R23)
- [ ] T16 — `StepError.tsx`: icono ⚠ rojo, botón Reintentar (re-submit) y Volver (step 0 con datos preservados); `aria-live="assertive"` (R17, R23)
- [ ] T17 — `StepThanks.tsx`: icono ✓, "¡Gracias, [nombre]!", chip contador `N de M`; fila share; checkbox newsletter (no pre-marcado); `aria-live="polite"` (R18, R22)

## Accesibilidad y motion

- [ ] T18 — `min-height / min-width: 44px` en todos los interactivos (R24)
- [ ] T19 — Todas las animaciones con fallback `prefers-reduced-motion: reduce` (R25, R21)

## Verificación

- [ ] T20 — Abrir Sign Flow desde landing → modal/bottom-sheet en desktop/mobile
- [ ] T21 — Consentimiento no marcado → botón desactivado
- [ ] T22 — Submit con datos válidos → Estado 1 → Estado 2
- [ ] T23 — `confirmation_token` visible en logs de la API en dev
- [ ] T24 — GET /confirm/{token} → `status='confirmada'`, retorna `{count, goal}` → Estado 4 con contador
- [ ] T25 — Submit duplicado (mismo email, misma campaña) → Estado 3 con mensaje claro
- [ ] T26 — Cédula inválida → error 422 → Estado 3
- [ ] T27 — Esc cierra el modal; foco vuelve al botón CTA de la landing

---

## Addendum — Iteración 2026-07-01 (R26–R40, D8–D12)

### API — migración y schema

- [ ] T28 — `migrations/versions/010_add_country_to_signatures.py`: ADD COLUMN `country VARCHAR(100)` nullable en `signatures` (D9)
- [ ] T29 — `schemas/signature.py`: agregar campos opcionales `signer_type: Literal['natural','org'] = 'natural'`, `org_name: str | None = None`, `location_mode: Literal['nacional','internacional'] = 'nacional'`, `country: str | None = None` (R31, R35)

### API — servicio y router

- [ ] T30 — `services/signature_service.py`: usar `data.signer_type` en lugar de hardcode `"natural"`; persistir `org_name` (y calcular `org_name_hash` con HMAC); persistir `country` si `location_mode = 'internacional'` (D10)
- [ ] T31 — `services/signature_service.py`: validar campos requeridos contra `required_fields` del `form_config` de la campaña antes de insertar; omitir validación de cédula si `"cedula"` no está en `required_fields` (R27, D11)
- [ ] T32 — `routers/public_campaign.py` → `_serialize()`: extraer `form_config` de `campaign.meta` y añadirlo como clave de primer nivel en el response; aplicar defaults si falta alguna clave (R26)
- [ ] T33 — `scripts/seed_dev.py`: agregar `meta={"form_config": {"signer_types": ["natural","org"], "location_modes": ["nacional","internacional"], "required_fields": ["nombre","email","cedula","location"], "visibility_options": ["publica","anonima","secreta"]}}` a la campaña dev (D8)

### Frontend — types y state

- [ ] T34 — `lib/campaign-api.ts`: agregar `form_config: FormConfig` a `PublicCampaign` con la interfaz `FormConfig { signer_types, location_modes, required_fields, visibility_options }` (R26)
- [ ] T35 — `components/sign-flow/SignFlow.tsx`: extender `SignFlowState` con `signer_type`, `org_name`, `location_mode`, `country`; actualizar state inicial y el payload enviado en Estado 1 (R31, R35)

### Frontend — StepForm

- [ ] T36 — `StepForm.tsx`: agregar sección toggle **Persona natural / Organización** antes del campo Nombre; mostrar solo si `form_config.signer_types.length > 1` (R28–R29)
- [ ] T37 — `StepForm.tsx`: campo **Nombre de la organización** condicional bajo el toggle; `required` si `"org_name"` en `required_fields` (R30)
- [ ] T38 — `StepForm.tsx`: agregar toggle **Nacional / Internacional** (radio-style con checkmark) antes del campo de ubicación; mostrar solo si `form_config.location_modes.length > 1` (R32–R33)
- [ ] T39 — `StepForm.tsx`: renderizar select de provincia si `location_mode = 'nacional'` (actual); renderizar campo texto País si `location_mode = 'internacional'` (R34–R35)
- [ ] T40 — `StepForm.tsx`: campo cédula — `required` condicionalmente según `"cedula"` en `required_fields` del `form_config` (R36)
- [ ] T41 — `StepForm.tsx`: radio group visibilidad — filtrar `VIS_OPTIONS` a solo las incluidas en `form_config.visibility_options`; ocultar grupo si solo hay una opción y aplicarla automáticamente (R37–R40)
- [ ] T42 — `lib/signatures-api.ts`: incluir `signer_type`, `org_name`, `location_mode`, `country` en el payload del POST (R31, R35)

### Verificación addendum

- [ ] T43 — Con `signer_types: ["natural"]` → toggle tipo invisible; formulario igual que hoy
- [ ] T44 — Con `signer_types: ["natural","org"]` → toggle visible; elegir "Organización" → campo org_name aparece; submit guarda `signer_type="org"` y `org_name` en DB
- [ ] T45 — Con `location_modes: ["nacional","internacional"]` → toggle ubicación visible; elegir "Internacional" → campo País aparece, provincia desaparece
- [ ] T46 — Con `visibility_options: ["publica","anonima"]` → botón "Secreta" no aparece
- [ ] T47 — Con `visibility_options: ["publica","anonima","secreta"]` → los tres botones aparecen
- [ ] T48 — Campaña con `"cedula"` fuera de `required_fields` → cédula no es requerida; firmante internacional puede enviar sin cédula
- [ ] T49 — Migration 010 aplica sin errores (`alembic upgrade head`)
