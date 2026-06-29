# Requirements — ui-design-system

Feature: Sistema de diseño UI (tokens, componentes base, flujo Claude Design)
Fase: 0 | Área: frontend | SDD: true

---

## Alcance

Establecer el sistema de diseño base de la plataforma. Neutro por defecto; cada campaña lo sobreescribe con su branding vía `meta` JSONB. El sistema se diseña primero en Claude Design (Adobe Express) y luego se traduce a Next.js + Tailwind.

---

## Requisitos EARS

### Tokens de diseño

**R1** — WHEN se renderiza cualquier página de la plataforma, THE SYSTEM SHALL aplicar los tokens base de color, tipografía y espaciado definidos en el sistema de diseño.

**R2** — WHEN una campaña tiene `meta.branding` definido en base de datos, THE SYSTEM SHALL sobreescribir los tokens base con los valores específicos de esa campaña (colores primario/secundario, fuente, logo).

**R3** — WHERE no exista `meta.branding` para una campaña, THE SYSTEM SHALL usar los tokens base neutros sin error ni fallback visible.

### Tipografía

**R4** — THE SYSTEM SHALL auto-hostear todas las fuentes usadas en el sistema de diseño en build time (sin carga desde CDN en runtime).

**R5** — THE SYSTEM SHALL definir una escala tipográfica con al menos 5 niveles (h1–h4 + body + caption) expresada como clases Tailwind.

### Paleta de colores

**R6** — THE SYSTEM SHALL definir una paleta base con tokens semánticos: `brand-primary`, `brand-secondary`, `surface`, `surface-muted`, `text-primary`, `text-muted`, `border`, `success`, `warning`, `danger`.

**R7** — WHEN `meta.branding.primary_color` y `meta.branding.secondary_color` están presentes, THE SYSTEM SHALL inyectarlos como variables CSS (`--brand-primary`, `--brand-secondary`) en el layout raíz de la campaña.

### Componentes base

**R8** — THE SYSTEM SHALL proveer los siguientes componentes React base con variantes Tailwind:
- `Button` — variantes: `primary`, `secondary`, `ghost`, `danger`; tamaños: `sm`, `md`, `lg`
- `Card` — con slots para header, body y footer opcionales
- `Badge` — variantes de estado: `active`, `collecting`, `delivered`, `dialog`, `decided`, `draft`
- `FormField` — label, input/textarea, mensaje de error, estado disabled
- `Alert` — variantes: `info`, `success`, `warning`, `error`

**R9** — WHEN un componente está en estado `disabled`, THE SYSTEM SHALL aplicar opacity reducida y cursor `not-allowed` sin JS adicional.

**R10** — THE SYSTEM SHALL definir los componentes como Server Components por defecto; solo serán Client Components si requieren interactividad (eventos, estado local).

### Accesibilidad

**R11** — THE SYSTEM SHALL garantizar contraste mínimo WCAG AA (4.5:1) en texto sobre fondo para los tokens base.

**R12** — THE SYSTEM SHALL incluir atributos `aria-label` o `role` en componentes interactivos donde el texto visible no sea suficiente.

### Diseño y artefactos

**R13** — THE SYSTEM SHALL tener un diseño aprobado en Claude Design (Adobe Express) antes de implementarse en Next.js.

**R14** — THE SYSTEM SHALL exportar el HTML de Claude Design y guardarlo en `specs/ui-design-system/design-export.html` como referencia permanente.

**R15** — THE SYSTEM SHALL traducir el HTML exportado a clases Tailwind; ningún componente usará `style` inline proveniente del export.
