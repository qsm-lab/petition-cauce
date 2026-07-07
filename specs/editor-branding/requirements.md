# Requirements — editor-branding

Feature: Editor de branding por campaña (Fase 2)
Estado: spec_ready → aprobado

---

## Contexto

El sistema de diseño Lime/Ink (rediseñado con Claude Design en Sesión 19) es la base visual de todas las campañas. El editor de branding **no reemplaza ese sistema** — permite ajustes controlados sobre él: color primario de la campaña y textos de identidad.

Funcionalidades ya implementadas (en `/admin/campaigns/[id]/`, heredadas de forms-qsm):
- `WelcomeConfigEditor.tsx` — logo URL, título, eslogan, descripción, colores de texto
- `SocialLinksEditor.tsx` — instagram, facebook, tiktok, whatsapp, newsletter, website, share_text

El trabajo es **portar y adaptar** estos componentes al nuevo editor (`/admin/campanas/[id]/CampanaEditorClient`), integrarlos con el design system Lime/Ink, y unificar el guardado con el submit principal.

---

## Requisitos

### Bloque A — Color primario de campaña

**R1** — El sistema DEBE permitir al administrador seleccionar un color primario para la campaña (el botón CTA, elementos de acento) mediante `<input type="color">`.

**R2** — El color primario DEBE afectar únicamente el token `--bp`; el resto del design system (tipografía, radios, superficies, sidebar admin) se mantiene intacto.

**R3** — El sistema DEBE ofrecer 3 presets rápidos: Bosque (`#D7F24C`, por defecto), Océano (`#0C6FB0`), Fuego (`#E63946`). Un clic rellena el picker con ese valor.

**R4** — El valor de color se guarda como `meta.branding.primary_color`. La landing ya lee este valor vía `campaignStyleTag()` — no requiere cambios en la landing.

**R5** — El sistema DEBE validar que el valor sea hex válido antes de incluirlo en el payload; valor inválido se omite silenciosamente.

### Bloque B — Copys de bienvenida (portado desde WelcomeConfigEditor)

**R6** — El sistema DEBE permitir configurar: URL del logo (`welcome_logo_url`), título (`welcome_title`), eslogan (`welcome_slogan`), descripción (`welcome_description`).

**R7** — Si se provee `welcome_logo_url`, el editor DEBE mostrar una miniatura de previsualización.

**R8** — Los campos de tamaño de título/eslogan (`welcome_title_size`, `welcome_slogan_size`) y colores de texto (`welcome_title_color`, `welcome_slogan_color`) se mantienen pero en modo avanzado (colapsados por defecto).

### Bloque C — Página de agradecimiento

**R9** — El sistema DEBE permitir configurar `thank_you_title` y `thank_you_body` (portado desde el editor heredado).

### Bloque D — Redes sociales (portado desde SocialLinksEditor)

**R10** — El sistema DEBE permitir configurar: instagram, facebook, tiktok, whatsapp, newsletter, website.

**R11** — Los enlaces se validan como URLs válidas; campo vacío elimina el enlace.

### Bloque E — Integración con el editor principal

**R12** — Todos los campos de branding se incluyen en el payload del submit principal del editor (`handleSave`) — sin botón de guardado separado.

**R13** — No se requieren nuevos endpoints; todo va por `PATCH /v1/campaigns/{id}` existente.

**R14** — No se requieren nuevas migraciones — meta es JSONB.

---

## Fuera de alcance

- Cambio de tipografía por campaña
- Cambio de border-radius, superficies, sidebar
- Preview en iframe (el admin puede abrir la landing en nueva pestaña)
- Upload directo de imágenes (se ingresa URL)
- Soporte dark mode por campaña
