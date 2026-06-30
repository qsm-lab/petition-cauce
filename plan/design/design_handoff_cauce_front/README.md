# Handoff: Plataforma de Firmas Ambientales — Ecuador

> **Date:** June 28, 2026  
> **Design tool:** HTML prototypes (Design Components)  
> **Status:** High-fidelity, ready for implementation

---

## Overview

A petition / signature-collection platform for environmental campaigns in Ecuador. Citizens visit a campaign page, read the cause, and add their legally-valid digital signature with double opt-in email confirmation. The platform is fully **themeable** via semantic design tokens — the same components render the "Bosque" (green) brand, the "Océano" (blue) brand, and dark mode without any code changes.

Three screens are in scope:

| # | Screen | File |
|---|--------|------|
| 1 | Campaign Detail Page | `CampaignPage.dc.html` |
| 2 | Sign Flow (modal/bottom-sheet) | `SignFlow.dc.html` |
| 3 | Design canvas with all frames | `Plataforma Firmas.dc.html` |

---

## About the Design Files

The `.dc.html` files in this bundle are **interactive HTML prototypes** — they show intended look, layout, and behavior. They are **not** production code to copy directly. Your task is to **recreate these designs in your target codebase** (React, Vue, Next.js, etc.) using its established patterns, routing, and component libraries, while matching these designs pixel-accurately.

Open any `.dc.html` file directly in a browser to interact with the prototype. `Plataforma Firmas.dc.html` is the full design canvas with all frames and annotations.

---

## Fidelity

**High-fidelity.** Exact colors (semantic tokens listed below), typography, spacing, border radii, shadows, animations, hover/focus states, and copy are all final. Recreate pixel-accurately using the codebase's component library.

---

## Design Token System

All components consume **semantic CSS custom properties** — no hard-coded hex values anywhere. Theming is done by changing the token values in the host shell; components never need to be touched.

### Token Reference

| Token | Role | Bosque (light) | Océano (light) | Bosque (dark) |
|-------|------|---------------|----------------|---------------|
| `--bp` / `--brand-primary` | Primary action, progress, links | `#18794A` | `#0C6FB0` | `#35C97B` |
| `--bop` / `--brand-on-primary` | Text on primary bg | `#ffffff` | `#ffffff` | `#08130C` |
| `--bsec` / `--brand-secondary` | Accent, live dot | `#2F855A` | `#0E8C86` | `#35C97B` |
| `--bink` / `--brand-ink` | Body text, headings | `#15241B` | `#0F2433` | `#E7F1E9` |
| `--bmut` / `--brand-muted` | Secondary text, labels | `#5A6B60` | `#4F6675` | `#9CB2A2` |
| `--bsurf` / `--brand-surface` | Card background | `#ffffff` | `#ffffff` | `#17241B` |
| `--bbg` / `--brand-bg` | Page background | `#EEF4EC` | `#EAF3F9` | `#0E1712` |
| `--bbord` / `--brand-border` | Dividers, input borders | `#DBE6D6` | `#D2E2EE` | `#2B3B30` |
| `--br` / `--radius` | Card border radius | `24px` | `24px` | `24px` |
| `--fd` | Display font family | `'Poppins', sans-serif` | `'Poppins', sans-serif` | `'Poppins', sans-serif` |
| `--fb` | Body font family | `'Inter', sans-serif` | `'Inter', sans-serif` | `'Inter', sans-serif` |

### Font Imports

```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## Screen 1 — Campaign Detail Page

### Layout — Mobile (≤ 767px)

Single-column scroll. All elements stack vertically with `16px` horizontal padding and `18px` gap between cards. Page background: `--bbg`. Scroll container is `position: relative; overflow-y: auto`.

**Stacking order (top → bottom):**

1. Hero image area
2. Campaign title
3. Action block (CTA card) ← _observed by IntersectionObserver_
4. Lifecycle / progress steps
5. "Lo que pedimos" + "Por qué importa" (petition body)
6. Recent signatures (live feed)
7. Share section
8. Support by region
9. Organization card
10. Attached documents
11. `48px` bottom spacer (for floating CTA clearance)

### Layout — Desktop (≥ 768px)

Two-column CSS Grid: `grid-template-columns: 1fr 360px; gap: 26px`. Max content width `1180px`, centered, padding `0 28px`. Right column (aside) is `position: sticky; top: 18px`.

**Main column** contains: petition body, lifecycle, recent signatures, region map, org card, documents.  
**Aside** contains: action block (CTA), share panel, campaign details list.

---

### Hero

- Height: `196px` mobile / `300px` desktop
- Background: diagonal repeating-linear-gradient using `--bp` at ~16% opacity over `--bbg`
- Overlay: `linear-gradient(180deg, transparent 38%, rgba(--bink, 0.78))`
- Category badge: top-right pill — bg `--bp`, text `--bop`, font-weight 700, 11.5px
- Org avatar: bottom-left — `38×38px`, border-radius `11px`, bg `--bsurf`, color `--bp`, Poppins 800 16px
- Image placeholder text at top-left: `[ imagen del páramo ]` — replace with `<img>` in production

### Campaign Title

- Font: Poppins 800, `24px` mobile / `34px` desktop
- Color: `--bink`
- `letter-spacing: -0.01em`, `line-height: 1.12`
- `max-width: 18ch`
- Padding: `18px 16px 0` mobile / via grid container desktop

### Action Block (CTA Card)

All values identical in mobile (main column) and desktop (aside), except desktop uses `38px` font for the count and `20px` padding.

| Element | Spec |
|---------|------|
| Card bg | `--bsurf` |
| Card border | `1px solid --bbord` |
| Card border-radius | `--br` (24px) |
| Card shadow | `0 10px 30px color-mix(in srgb, --bp 9%, transparent)` |
| Signature count | Poppins 800, `34px` mobile / `38px` desktop, color `--bink` |
| "de N firmas" | Inter 600, 14/15px, color `--bmut` |
| Progress bar track | `height: 12px`, border-radius `99px`, bg `color-mix(in srgb, --bp 12%, --bbg)` |
| Progress bar fill | bg `linear-gradient(90deg, color-mix(in srgb, --bp 82%, #fff), --bp)`, transition `width 1.1s cubic-bezier(.22,1,.36,1)` — animate from 0 on mount |
| "Dirigida a" chip | bg `--bbg`, border-radius `14px`, padding `12px 14px`, icon 🏛️ |
| CTA button | Width 100%, min-height `54px`, border-radius `99px`, bg `--bp`, color `--bop`, Poppins 700, `17px`, shadow `0 8px 22px color-mix(in srgb, --bp 34%, transparent)` |
| Privacy note | `11.5px`, color `--bmut`, centered, "🔒 Confirmación por correo · privacidad por defecto" |

### Floating CTA (Mobile Only)

**Trigger:** `IntersectionObserver` watches the Action Block. When the block scrolls out of the viewport (`isIntersecting = false`), a floating bar appears at the bottom of the screen.

**Appearance:**
- `position: fixed` (or `absolute` within the scroll container), `bottom: 0`, full width
- Padding: `0 16px 28px` (28px accounts for iOS safe area)
- Background: `linear-gradient(to top, --bbg 58%, transparent)` — fades into the page content
- Contains the same CTA button as the action block
- Entry animation: `opacity 0→1 + translateY(10px→0)`, duration `220ms`, ease-out
- Disappears when the user scrolls back up and the Action Block re-enters the viewport
- **Desktop:** never shown — aside is already sticky

### Lifecycle / Progress Steps

5 steps: "Lanzada" → "Recolección" → "Entrega" → "Diálogo" → "Decisión"

- Layout: `display: flex; justify-content: space-between` with an absolute horizontal line behind at `top: 13px`
- Track line: bg `--bbord`, height `3px`, border-radius `99px`, left `8%`, right `8%`
- Progress fill: same height, bg `--bp`, width = `(currentStepIndex / 4) * 84%`
- Step dot: `28×28px`, border-radius `99px`
  - Done: bg `--bp`, color `--bop`, shows ✓
  - Current: bg `--bp`, color `--bop`, box-shadow `0 0 0 4px color-mix(in srgb, --bp 22%, transparent)`, shows step number
  - Future: bg `--bsurf`, color `--bmut`, border `2px solid --bbord`, shows step number
- Step label: `10px`, text-align center, `margin-top: 7px`
  - Current: color `--bink`, font-weight 800
  - Done: color `--bink`, font-weight 600
  - Future: color `--bmut`

### Petition Body Card

- Section heading "Lo que pedimos": Poppins 700, `18px`, color `--bink`, `margin-bottom: 12px`
- Asks list: no bullets, `gap: 11px`; each item is `display: flex; gap: 11px`
  - Check icon: `22×22px` circle, bg `color-mix(in srgb, --bp 14%, transparent)`, color `--bp`, ✓ symbol, `font-size: 12px`, centered
  - Text: `14.5px`, line-height `1.5`, color `--bink`
- Section heading "Por qué importa": same as above, `margin-top: 18px`
- Body paragraphs: `14.5px`, line-height `1.68`, color `color-mix(in srgb, --bink 86%, --bbg)`, `max-width: 68ch`

### Recent Signatures (Live Feed)

- Live indicator: `8×8px` circle, bg `--bsec`, animation `pulse 1.6s ease-in-out infinite` (opacity 1→0.35→1)
- Label: uppercase, `11px`, letter-spacing `.06em`, color `--bmut`, font-weight 700
- Each row: `display: flex; align-items: center; gap: 11px; padding: 8px 0; border-bottom: 1px solid color-mix(in srgb, --bbord 60%, transparent)`
- Avatar: `34×34px`, border-radius `99px`
  - Named: bg `color-mix(in srgb, --bp 15%, transparent)`, color `--bp`, shows first letter
  - Anonymous: bg `--bbg`, color `--bmut`, border `1px solid --bbord`, shows 🔒
- Name: `13.5px`, font-weight 600, color `--bink`
- Meta (city · time): `11.5px`, color `--bmut`
- Footer note: `11.5px`, color `--bmut` — "Quienes eligen firma anónima o secreta aparecen como 'Anónimo'."

### Share Section

Mobile: main column card. Desktop: aside card.

- WhatsApp button: full green pill (`--bp` bg, `--bop` text), min-height `48px` mobile / `46px` desktop
- Telegram: outlined pill, color `--bink`
- Facebook / X / Correo: equal-flex outlined pills, color `--bmut`, `44px` height
- URL input: `border-radius: 12px`, bg `--bbg`, border `1.5px solid --bbord`; right side "Copiar" button — bg `--bp`, color `--bop`
- QR placeholder: `64×56px` (mobile/desktop), border-radius `12px` — replace with real QR in production

### Region Map

- Left: `132×150px` placeholder for SVG Ecuador choropleth map
- Right: bar chart per province — label + percentage, 7px height bar, bg `color-mix(in srgb, --bp 12%, --bbg)`, fill `--bp`

### Organization Card

- Avatar: `52×52px`, border-radius `15px`, bg `color-mix(in srgb, --bp 14%, transparent)`, color `--bp`, Poppins 800 20px
- Label: uppercase 11px, `--bmut`
- Name: Poppins 700 15px, `--bink`
- "Ver perfil" button: outlined pill, `min-height: 40px`, color `--bp`, border `1.5px solid --bbord`

### Attached Documents

- Section heading: Poppins 700, `16px`, color `--bink`
- Each document row: `display: flex; align-items: center; gap: 12px; padding: 11px 12px; background: --bbg; border-radius: 14px; border: 1px solid --bbord`
- PDF icon: `38×44px`, border-radius `8px`, bg `color-mix(in srgb, --bp 10%, transparent)`, border `1.5px solid color-mix(in srgb, --bp 22%, transparent)`, 📄 emoji at 15px + "PDF" label at 7px Poppins 800
- File name: `13px`, font-weight 600, color `--bink`, 2-line clamp with `-webkit-line-clamp: 2`
- File size: `11px`, color `--bmut`, format: "3.2 MB · PDF"
- Download button: `36×36px` circle, bg `color-mix(in srgb, --bp 12%, transparent)`, color `--bp`, "↓" at 18px, `aria-label="Descargar documento"`
- Footer note: `11.5px`, `--bmut` — "Los documentos son públicos. Puedes compartirlos libremente."
- Max 5 documents per campaign (enforced at upload time)

---

## Screen 2 — Sign Flow

Displayed as a **bottom sheet on mobile** (slides up from bottom, `border-radius: 28px 28px 0 0`) and as a **centered modal on desktop** (`width: 420px`, same border-radius all around). Opened when user taps "Firmar esta petición". Backdrop: `rgba(15,20,16,.5)` + `backdrop-filter: blur(2px)`. Press Esc or tap backdrop to close.

The sheet has 5 sequential states (steps 0–4):

### State 0 — Form

Entry animation: `translateY(8px)→0 + opacity 0→1`, 250ms ease.

**Header** (sticky, `flex: 0 0 auto`):
- Drag handle: `38×5px` pill, bg `--bbord`, centered, `margin-bottom: 12px`
- Title: Poppins 700, `17px` — "Firmar esta petición"
- Subtitle: `12.5px`, `--bmut` — "Páramo del Cajas · 2 datos obligatorios"
- Close button: `44×44px`, border-radius `99px`, ✕ at 22px, color `--bmut`; hover bg `--bbg`

**Form fields** (scrollable body):

| Field | Type | Spec |
|-------|------|------|
| Nombre completo | text | min-height 48px, padding `0 16px`, border-radius `16px`, bg `--bbg`, border `1.5px solid --bbord`; focus: border `--bp` + outline 3px `color-mix(in srgb, --bp 40%, transparent)` |
| Correo electrónico | email | Same style; helper text: "Lo usamos solo para confirmar tu firma. No lo publicamos." |
| Cédula | numeric | Same style, `inputmode="numeric"`, placeholder "0102030405" |
| Provincia | select | Same style, `appearance: none`; options: Azuay, Pichincha, Guayas, Loja, Cañar, Otra |

**Visibility radio group** (3 options: Pública / Anónima / Secreta):
- Default: **Anónima**
- Each option: `flex: 1`, min-height `48px`, border-radius `14px`, font-size `13px`, font-weight 600
  - Active: bg `--bp`, color `--bop`, border `1.5px solid --bp`
  - Inactive: bg `--bbg`, color `--bink`, border `1.5px solid --bbord`
- Description micro-copy updates per selection:
  - Pública: "Tu nombre y provincia aparecerán en la lista pública de firmas."
  - Anónima: "Aparecerás como "Anónimo" en las listas. Tus datos van solo a la autoridad. (Recomendado)"
  - Secreta: "No apareces en ninguna lista. Solo la autoridad te cuenta para el total."

**Consent checkbox** (`role="checkbox"`, accent-color `--bp`, `22×22px`):
- Container: `display: flex; gap: 11px`, padding `12px 14px`, border `1.5px solid --bbord` (changes to `--bp` when checked), border-radius `16px`
- **Not pre-checked by default** (privacy by default)
- Links to `/aviso-de-privacidad`
- Text: "He leído y acepto el aviso de privacidad. Mis datos se entregan a la autoridad como respaldo del trámite. Puedo revocar mi consentimiento cuando quiera."

**Submit button:**
- Enabled: bg `--bp`, color `--bop`, Poppins 700 16px, min-height `52px`, border-radius `99px`, shadow `0 6px 18px color-mix(in srgb, --bp 32%, transparent)`
- Disabled (consent unchecked): bg `--bbord` (`#cdd6c9`), color `--bmut`, `cursor: not-allowed`
- Label: "Firmar la petición"
- Footer note: "Verificación anti-bot invisible · doble confirmación por correo"

### State 1 — Sending

- Spinner: `52×52px` border-spinner, border `5px solid --bbord`, top `--bp`, animation `rotate 0.9s linear infinite`
- Title: Poppins 600 16px — "Registrando tu firma…"
- Subtitle: `13px`, `--bmut` — "Un momento, no cierres esta ventana."
- Transition to State 2 after ~1300ms (simulated; real: API response)

### State 2 — Success / Double Opt-in

- Icon: ✉️, `64×64px` circle bg `color-mix(in srgb, --bsec 16%, transparent)`, color `--bsec`; animation `scale(.6)→scale(1.08)→scale(1)`, 400ms ease
- Title: Poppins 700 19px — "Casi listo: revisa tu correo"
- Body: email address shown in bold, explains double opt-in
- Primary CTA: "Ya confirmé — continuar →" → leads to State 4
- Secondary: "Reenviar correo de confirmación" (outlined pill)
- Note: "¿No llega? Revisa spam o vuelve a intentarlo en 1 minuto."

### State 3 — Error

- Icon: ⚠, `64×64px` circle, bg/color using `#d9483b`
- Title: Poppins 700 18px — "No pudimos registrar tu firma"
- Body: "Hubo un problema de conexión. Tus datos no se perdieron: solo vuelve a intentar."
- Primary CTA: "Reintentar" → re-triggers submit
- Secondary: "Volver al formulario" → State 0 (form data preserved)

### State 4 — Thank You

- Icon: ✓, `60×60px`, same pop animation as State 2, color `--bsec`
- Title: Poppins 700 20px — "¡Gracias, [first name]!" (personalized if name was entered)
- Signature counter chip: large counter `192 de 500`, font Poppins 700 24px, color `--bp`; note "¡Acabas de mover el contador!"
- Share row: WhatsApp + Telegram + ⋯ more (same style as campaign page)
- Optional newsletter checkbox (separate consent, unchecked by default): "Quiero recibir novedades de esta causa por correo."
- Header subtitle changes to "Tu apoyo quedó registrado"

---

## Interactions & Behavior

### Floating CTA (mobile)

```
1. Mount IntersectionObserver on the Action Block element (the CTA card)
   → root: the scroll container, threshold: 0
2. isIntersecting = false  →  show floating bar (fade + slide-up, 220ms)
3. isIntersecting = true   →  hide floating bar
4. Floating bar taps same handler as the main CTA button → opens Sign Flow
5. Desktop: never render this bar (aside is sticky)
```

### Progress Bar Animation

On mount: `requestAnimationFrame → setTimeout(60ms) → setState({ width: actualPct% })`. This prevents layout shift and triggers the CSS transition (`1.1s cubic-bezier(.22,1,.36,1)`).

### Sign Panel

- Mobile: slides up as a bottom sheet (`align-items: flex-end` on overlay)
- Desktop: centered modal (`align-items: center; justify-content: center; padding: 24px`)
- Backdrop click → close
- Esc key → close
- `role="dialog"`, `aria-modal="true"`, `aria-label="Firmar esta petición"`
- Focus trap required in production

### Reduced Motion

All animations must respect `prefers-reduced-motion: reduce`. When set, transition durations become `0.001ms` effectively disabling them.

---

## State Management

### CampaignPage

```ts
interface CampaignPageState {
  panelOpen: boolean;       // Sign Flow modal open/closed
  barW: number;             // Progress bar width % (animated on mount)
  showFloat: boolean;       // Floating CTA visible (mobile only)
}
```

Campaign data is fetched from the API (slug from URL). Prototype uses static fixture data — see the `data()` method in `CampaignPage.dc.html` for the full shape.

### SignFlow

```ts
interface SignFlowState {
  step: 0 | 1 | 2 | 3 | 4;   // Form | Sending | Success | Error | Thanks
  name: string;
  email: string;
  cedula: string;
  provincia: string;
  vis: 'pub' | 'anon' | 'sec'; // default: 'anon'
  consent: boolean;             // default: false (NEVER pre-check)
  subscribe: boolean;           // default: false
}
```

---

## Campaign Data Shape

```ts
interface Campaign {
  category: string;           // e.g. "Agua y páramos"
  title: string;
  org: string;                // Organization name
  orgInitial: string;         // 1-2 char avatar initial
  count: number;              // Current signature count
  goal: number;               // Target count
  pct: number;                // Percentage (0-100)
  authority: string;          // Target authority name
  stageIndex: number;         // 0-4, current lifecycle stage
  asks: string[];             // List of specific demands
  reason: string[];           // Paragraphs explaining the cause
  recent: SignaturePreview[];
  regions: RegionStat[];
  docs: Document[];
}

interface SignaturePreview {
  name: string;
  city: string;
  time: string;   // e.g. "hace 2 min"
  anon: boolean;
}

interface RegionStat {
  name: string;  // Province name
  pct: number;   // 0-100
}

interface Document {
  name: string;  // Full document name
  size: string;  // e.g. "3.2 MB"
  // url: string; // Download URL (add in production)
}
```

---

## Accessibility Requirements

All of the following are implemented in the prototype and must be preserved in production:

- WCAG 2.1 AA contrast on all 3 theme presets (Bosque light, Océano light, Bosque dark)
- All interactive elements have `min-height / min-width: 44px` (iOS tap target)
- Progress bars have `role="progressbar"` with `aria-valuenow/min/max` and `aria-label`
- Signature visibility uses `role="radiogroup"` and `role="radio"` with `aria-checked`
- All form inputs have associated `<label>` elements
- Sign modal has `role="dialog"`, `aria-modal="true"`, `aria-label`
- **Focus trap** inside the Sign modal (not in prototype — must be added in production)
- Esc key closes the Sign modal
- Animated elements use `aria-hidden="true"` where decorative
- `aria-live="polite"` on success/error states; `aria-live="assertive"` on error state
- `aria-busy="true"` during the sending step
- `prefers-reduced-motion` respected globally

---

## Assets

| Asset | Status | Notes |
|-------|--------|-------|
| Hero image | **Placeholder** | Replace `[ imagen del páramo ]` text with a real `<img>` (16:9 or 2:1 ratio) |
| Ecuador province map | **Placeholder** | Replace the diagonal-pattern div with an SVG choropleth |
| QR code | **Placeholder** | Generate dynamically per campaign slug (e.g. `firma.ec/{slug}`) |
| PDF file icon | Emoji 📄 | Replace with SVG icon from your design system |
| Google Fonts | CDN | Poppins (500/600/700/800) + Inter (400/500/600/700). Self-host for production. |

---

## Files in This Package

| File | Description |
|------|-------------|
| `README.md` | This document |
| `CampaignPage.dc.html` | Campaign detail page — mobile + desktop, all sections |
| `SignFlow.dc.html` | Sign flow modal — all 5 states |
| `Plataforma Firmas.dc.html` | Full design canvas with all frames, theming variants, and annotations |

Open `Plataforma Firmas.dc.html` in a browser for the interactive overview. All frames are pannable — use mouse drag to navigate the canvas.

---

## Implementation Notes for Claude Code

1. **Token injection:** The semantic tokens (`--bp`, `--bop`, etc.) should be set on the `<html>` or campaign wrapper element from a campaign's theme config stored in the database (JSONB recommended). This allows per-organization theming without code deploys.

2. **Floating CTA:** Use `IntersectionObserver` with the scroll container (not `window`) as `root`. Ensure the observer is disconnected on component unmount. Only mount on mobile breakpoint (< 768px).

3. **Progress bar:** Never set the final width immediately — always animate from 0 on mount to avoid a jarring jump. Use a `requestAnimationFrame` + small timeout pattern.

4. **Double opt-in:** The form submission triggers an email with a confirmation link. The signature is only counted (and the `count` incremented) after the user clicks the email link. The UI shows State 2 (check your email) immediately after submission, before confirmation.

5. **Privacy by default:** The signature visibility defaults to `anon` and the consent checkbox is **never pre-checked**. These are legal requirements for the Ecuadorian regulatory context.

6. **Document downloads:** Each document should have a signed URL with a short TTL (e.g. 15 minutes), generated server-side on demand. Do not expose permanent storage URLs.

7. **Responsive breakpoint:** The desktop layout kicks in at `768px` (can be adjusted, but this matches the prototype). Below that, mobile layout applies including the floating CTA.
