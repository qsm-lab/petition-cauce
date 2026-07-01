# Requisitos — formulario-firma + firma-visibilidad
> EARS notation. Fecha: 2026-06-30
> Diseño aprobado: plan/design/design_handoff_cauce_front/SignFlow.dc.html
> Este spec cubre 2 features del feature_list: formulario-firma, firma-visibilidad

---

## Referencia de diseño

El diseño de referencia es `plan/design/design_handoff_cauce_front/SignFlow.dc.html`.
Todos los valores del README (sección "Screen 2 — Sign Flow") son normativos.

---

## Apertura del Sign Flow

**R1** — El Sign Flow SHALL abrirse cuando el usuario pulsa el botón CTA de la landing (Action Block o Floating CTA).

**R2** — En mobile, SHALL mostrarse como bottom sheet (`border-radius: 28px 28px 0 0`, slide-up 250ms). En desktop (≥ 768px), SHALL mostrarse como modal centrado (`width: 420px`).

**R3** — El backdrop SHALL tener `rgba(15,20,16,.5)` con `backdrop-filter: blur(2px)`. Pulsar el backdrop o presionar Esc SHALL cerrar el Sign Flow.

**R4** — El Sign Flow SHALL tener `role="dialog"`, `aria-modal="true"`, `aria-label="Firmar esta petición"` y un focus trap activo mientras esté abierto.

---

## Campos del formulario (Estado 0 — Form)

**R5** — El formulario SHALL tener los campos: `nombre` (texto, obligatorio), `email` (email, obligatorio), `cedula` (numérico, obligatorio), `provincia` (select, obligatorio con opciones Azuay / Pichincha / Guayas / Loja / Cañar / Otra).

**R6** — Todos los campos SHALL tener `<label>` asociado, `min-height: 48px`, foco visible (`border: --bp + outline 3px`).

**R7** — El campo `cedula` SHALL tener `inputmode="numeric"` y aceptar solo dígitos numéricos en el frontend.

---

## Visibilidad de firma (firma-visibilidad)

**R8** — El formulario SHALL incluir un radio group "¿Cómo quieres aparecer?" con 3 opciones: Pública / Anónima / Secreta. El default SHALL ser **Anónima**. Esta es una decisión irrevocable por sesión (no se puede cambiar después de firmar sin ejercer derecho ARCO).

**R9** — El radio group SHALL tener `role="radiogroup"` y cada opción `role="radio"` con `aria-checked`.

**R10** — Bajo el radio group SHALL mostrarse una descripción contextual que cambia según la opción seleccionada (ver README para el copy exacto de cada opción).

---

## Consentimiento LOPDP

**R11** — El formulario SHALL incluir un checkbox de consentimiento que: (a) NO esté marcado por defecto, (b) tenga texto que mencione el fin específico de la campaña y el enlace a `/aviso-de-privacidad`, (c) cambie el borde del container a `--bp` cuando esté marcado.

**R12** — El botón "Firmar la petición" SHALL estar desactivado (`cursor: not-allowed`, bg `--bbord`) mientras el checkbox de consentimiento no esté marcado.

**R13** — La nota de pie SHALL leer: "Verificación anti-bot invisible · doble confirmación por correo".

---

## Flujo de estados (States 0–4)

**R14 — Estado 0 (Form):** formulario completo. Pulsar "Firmar" → Estado 1.

**R15 — Estado 1 (Sending):** spinner de 52px, título "Registrando tu firma…", sin botones. Hace POST a `/api/v1/signatures`. Al recibir 201 → Estado 2. Al recibir error → Estado 3.

**R16 — Estado 2 (Success / Double opt-in):** muestra email en bold, instruye revisar correo. CTA "Ya confirmé — continuar →" → Estado 4. "Reenviar correo" → llama endpoint de reenvío. Esta pantalla NO incrementa el contador aún (el contador sube al confirmar el email).

**R17 — Estado 3 (Error):** icono ⚠ rojo, título "No pudimos registrar tu firma", botón "Reintentar" (re-submit con datos existentes) y "Volver al formulario" (Estado 0 con datos preservados).

**R18 — Estado 4 (Thank You):** icono ✓ verde, "¡Gracias, [nombre]!", chip con contador actualizado ("N de M firmas"), fila de share (WhatsApp, Telegram), checkbox de newsletter separado (no pre-marcado).

---

## Doble opt-in

**R19** — El sistema SHALL generar un `confirmation_token` UUID al crear la firma y enviarlo por email al firmante (email a implementar con Resend cuando se active `resend_api_key`). En Fase 1, el email de confirmación puede ser un log en consola en dev; el flujo de estados ya existe.

**R20** — El endpoint `GET /api/v1/signatures/confirm/{token}` SHALL marcar la firma como `status = 'confirmada'` e incrementar el contador de la campaña. SHALL retornar 200 o 404 si el token no existe o ya fue usado.

**R21** — Solo las firmas con `status = 'confirmada'` son contadas en el total y aparecen en el feed de firmas recientes.

---

## Newsletter (consentimiento separado)

**R22** — El checkbox de newsletter en Estado 4 SHALL ser independiente del consentimiento de firma. No SHALL estar pre-marcado. El campo `subscribe_newsletter` en `consents` registra la elección.

---

## Accesibilidad

**R23** — `aria-live="polite"` en contenedor de éxito (Estado 2) y thank you (Estado 4). `aria-live="assertive"` en Estado de error (Estado 3). `aria-busy="true"` en Estado 1 (Sending).

**R24** — Todos los elementos interactivos SHALL tener `min-height / min-width: 44px`.

**R25** — Las animaciones SHALL respetar `prefers-reduced-motion`.

---

## State management del Sign Flow

```ts
interface SignFlowState {
  step: 0 | 1 | 2 | 3 | 4;
  signer_type: 'natural' | 'org';  // default: 'natural'
  org_name: string;                // solo si signer_type = 'org'
  name: string;
  email: string;
  cedula: string;
  location_mode: 'nacional' | 'internacional'; // default: 'nacional'
  provincia: string;               // solo si location_mode = 'nacional'
  country: string;                 // solo si location_mode = 'internacional'
  vis: 'pub' | 'anon' | 'sec';    // default: 'anon'; opciones filtradas por form_config
  consent: boolean;                // default: false — NUNCA pre-marcado
  subscribe: boolean;              // default: false
}
```

---

## Addendum — Iteración 2026-07-01

> Requisitos nuevos derivados de revisión de la UI del Sign Flow.
> Sujetos a ajuste fino después de verificación en browser.

---

## form_config — configuración por campaña desde el backend

**R26** — El endpoint público de campaña (`GET /v1/public-campaign/by-slug/{slug}`)
SHALL incluir un objeto `form_config` construido desde `campaign.meta["form_config"]`
con los siguientes campos y defaults:

```json
{
  "signer_types":      ["natural"],              // qué tipos de firmante están habilitados
  "location_modes":    ["nacional"],             // qué modos de ubicación están habilitados
  "required_fields":   ["nombre", "email", "cedula", "location"],
  "visibility_options": ["publica", "anonima"]   // "secreta" NO por defecto
}
```

**R27** — El backend SHALL validar el payload de firma contra el `form_config` de la campaña:
si un campo está en `required_fields` y viene vacío o nulo, SHALL retornar 422.

---

## Tipo de firmante (signer_type toggle)

**R28** — WHEN `form_config.signer_types` contiene solo `"natural"`, THEN el toggle
de tipo de firmante SHALL NOT mostrarse en el formulario.

**R29** — WHEN `form_config.signer_types` contiene `["natural", "org"]`, THEN SHALL
aparecer un selector de tipo al inicio del formulario (antes de Nombre completo) con
dos opciones: **"Persona natural"** y **"Organización"**. Default SHALL ser `"natural"`.

**R30** — WHEN el firmante selecciona **"Organización"**, THEN SHALL aparecer un campo
de texto **"Nombre de la organización"** inmediatamente después del selector de tipo.
El campo SHALL ser requerido si `"org_name"` está en `required_fields`.

**R31** — El tipo de firmante elegido SHALL enviarse al backend en el campo `signer_type`
(`"natural"` o `"org"`).

---

## Ubicación (nacional / internacional)

**R32** — WHEN `form_config.location_modes` contiene solo `"nacional"`, THEN el toggle
nacional/internacional SHALL NOT mostrarse y el formulario SHALL mostrar directamente
el select de provincia (comportamiento actual).

**R33** — WHEN `form_config.location_modes` contiene `["nacional", "internacional"]`,
THEN SHALL aparecer un toggle **"Nacional / Internacional"** (radio-style con
checkmark activo) antes del campo de ubicación. Default SHALL ser `"nacional"`.

**R34** — WHEN el modo activo es **"Nacional"**, THEN SHALL mostrarse el select de
provincia (comportamiento actual).

**R35** — WHEN el modo activo es **"Internacional"**, THEN SHALL mostrarse un campo
de texto libre **"País"** en lugar del select de provincia.

**R36** — La cédula SHALL mantenerse visible con `required` si `"cedula"` está en
`required_fields` del `form_config`. Para firmantes internacionales la campaña
PUEDE quitar `"cedula"` de `required_fields` desde el backend.

---

## Visibilidad configurable desde el backend

**R37** — El radio group "¿Cómo quieres aparecer?" SHALL renderizar SOLO las opciones
listadas en `form_config.visibility_options`.

**R38** — Por defecto `visibility_options = ["publica", "anonima"]`. La opción
**"Secreta"** SHALL NOT aparecer en el frontend a menos que el backend la incluya
explícitamente en `visibility_options`.

**R39** — WHEN `visibility_options` contiene solo una opción, THEN el radio group
SHALL NOT mostrarse y esa opción SHALL aplicarse automáticamente al formulario.

**R40** — El default del radio group SHALL ser la primera opción que sea `"anonima"`
en la lista; si no hay `"anonima"`, SHALL ser la primera opción disponible.
