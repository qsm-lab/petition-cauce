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
