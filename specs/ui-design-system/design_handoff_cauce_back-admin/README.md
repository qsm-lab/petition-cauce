# Handoff: Panel de Administración — FirmaEC

> **Date:** June 29, 2026  
> **Scope:** Back-office admin panel — desktop only, no mobile version  
> **Status:** High-fidelity, ready for implementation  
> **Prototype:** Open `AdminPanel.dc.html` in a browser to interact

---

## Overview

Internal management panel for the FirmaEC platform. Two roles share the same login screen and shell; the visible navigation and data scope differ per role.

| Role | Access |
|------|--------|
| **Administrador** | Full platform: all campaigns, all organizations, all users, settings |
| **Gestor de campaña** | Scoped to their own organization's campaigns and signatures only |

The panel is **desktop-only** (`min-width: 1024px`). No responsive or mobile layout is required.

---

## Design Tokens

Same semantic token system as the public platform. The admin shell inverts `--bink` as the sidebar background.

| Token | Value |
|-------|-------|
| `--bp` | `#18794A` |
| `--bop` | `#ffffff` |
| `--bsec` | `#2F855A` |
| `--bink` | `#15241B` |
| `--bmut` | `#5A6B60` |
| `--bsurf` | `#ffffff` |
| `--bbg` | `#EEF4EC` |
| `--bbord` | `#DBE6D6` |

Font imports (self-host for production):
```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## Shell Layout

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (220px fixed)  │  Main content (flex: 1)       │
│  bg: --bink             │  bg: --bbg                    │
│  ─────────────────────  │  ┌─────────────────────────┐  │
│  Logo + brand name      │  │ Sticky page header      │  │
│  Nav items (6)          │  │ (bg: --bsurf, z:10)     │  │
│  ─────────────────────  │  ├─────────────────────────┤  │
│  User avatar + email    │  │ Scrollable content area │  │
│  Logout button ↩        │  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Sidebar spec

- Width: `220px`, `flex: 0 0 220px`, `overflow-y: auto`
- Background: `--bink` (`#15241B`)
- Logo area: `padding: 20px 18px 16px`, `border-bottom: 1px solid rgba(255,255,255,.07)`
  - Icon: `30×30px`, `border-radius: 9px`, bg `--bp`, Poppins 800 14px white
- Nav items: rendered from array, `gap: 1px`, `padding: 10px 0`
  - Each button: `width: calc(100% - 16px)`, `margin: 0 8px`, `padding: 10px 16px`, `border-radius: 10px`
  - Active: `background: rgba(255,255,255,.1)`, color `#fff`, `font-weight: 600`
  - Inactive: `background: transparent`, `color: rgba(255,255,255,.52)`, `font-weight: 500`
- User footer: `padding: 14px 16px`, `border-top: 1px solid rgba(255,255,255,.07)`
  - Avatar: `32×32px` circle, bg `color-mix(in srgb, --bp 45%, transparent)`, Poppins 700 13px
  - Name: `12.5px` 600 white; email: `10.5px` `rgba(255,255,255,.38)`
  - Logout: transparent button, `↩` at 16px, color `rgba(255,255,255,.38)`, hover `rgba(255,255,255,.8)`

### Main content

- `flex: 1`, `min-width: 0`, `overflow-y: auto`, bg `--bbg`
- Each view has a **sticky page header** (`position: sticky; top: 0; z-index: 10`) with white bg, `border-bottom: 1px solid --bbord`, `padding: 16px 24px`
- Content area: `padding: 24px`, entry animation `opacity 0→1 + translateY(5px→0)` 250ms ease (`prefers-reduced-motion` must disable it)

### Navigation items (ordered)

1. Resumen → `/admin/resumen`
2. Campañas → `/admin/campanas`
3. Firmas → `/admin/firmas` _(no dedicated list; links to last visited campaign's firmas)_
4. Organizaciones → `/admin/organizaciones`
5. Usuarios → `/admin/usuarios`
6. Configuración → `/admin/configuracion`

> **Role scoping:** Gestores only see Campañas, Firmas. The sidebar renders only the items their role permits.

---

## Views

### 1 · Login (`/admin/login`)

Centered card, `width: 420px`, `border-radius: 20px`, `padding: 40px`.  
Entry animation: `opacity 0→1 + translateY(5px→0)` 300ms.

**Role switcher** (above fields):
- Container: `padding: 4px`, bg `--bbg`, `border-radius: 12px`, `display: flex; gap: 4px`
- Each tab: `flex: 1`, `min-height: 36px`, `border-radius: 9px`, `font-weight: 600`, 13px
- Active tab: bg `--bsurf`, color `--bink`, `box-shadow: 0 1px 4px rgba(0,0,0,.10)`
- Inactive tab: bg transparent, color `--bmut`
- **Note:** the switcher is UI-only for the prototype. In production, the role is inferred from credentials server-side — no client-side toggle.

**Fields:**
- Email + Password — `min-height: 46px`, `border-radius: 12px`, `border: 1.5px solid --bbord`, bg `--bbg`
- Focus: `border-color: --bp`, `outline: 3px solid color-mix(in srgb, --bp 35%, transparent)`

**Submit button:** `min-height: 50px`, `border-radius: 12px`, bg `--bp`, color `--bop`, Poppins 700 16px, shadow `0 6px 18px color-mix(in srgb, --bp 30%, transparent)`.

**Forgot password link:** `font-size: 12.5px`, color `--bp`, centered below button.

**Footer note:** separated by `border-top: 1px solid --bbord`, `font-size: 11.5px`, color `--bmut`, centered, directs orgs to the public platform.

---

### 2 · Dashboard (`/admin/resumen`)

#### KPI cards row

4-column CSS grid, `gap: 16px`.

| Card | Value | Trend color |
|------|-------|-------------|
| Total firmas | 4,821 | `#18794A` (up) |
| Campañas activas | 12 | `--bmut` (neutral) |
| Pendientes revisión | 3 | `#c2410c` (alert) — border also uses this color at 30% |
| Tasa de conversión | 34% | `#18794A` (up) |

Each card: bg `--bsurf`, `border: 1px solid --bbord`, `border-radius: 14px`, `padding: 20px`.  
Label: 11px uppercase, letter-spacing `.06em`, `--bmut`, 700.  
Value: Poppins 800, 28px, `--bink`, `margin-bottom: 6px`.  
Trend: 12px, 600, color per table above.

#### Two-column row below (`grid-template-columns: 1fr 300px; gap: 20px`)

**Left — Recent campaigns table:**
- Card: bg `--bsurf`, border, `border-radius: 14px`, `overflow: hidden`
- Header: `padding: 14px 18px`, title Poppins 700 14px + "Ver todas →" link (color `--bp`, 12.5px)
- Each row: `padding: 11px 18px`, `border-bottom: 1px solid color-mix(in srgb, --bbord 50%, transparent)`
  - Title: 13px 600 `--bink`, truncated; org: 11px `--bmut`
  - Count: right-aligned, 12.5px 700; "de N": 10.5px `--bmut`
  - Status badge (same spec as Campaigns table below)

**Right — Activity feed:**
- Card: same shell
- Each item: `padding: 10px 16px`, `display: flex; gap: 10px`
  - Dot: `8×8px` circle, `margin-top: 4px`
    - Recent (green): bg `--bp`
    - Older (gray): bg `--bbord`
  - Text: 12.5px `--bink`, `line-height: 1.4`
  - Time: 11px `--bmut`

---

### 3 · Campañas (`/admin/campanas`)

**Header:** title + subtitle + "**+ Nueva campaña**" button (bg `--bp`, `border-radius: 10px`, `min-height: 38px`).

**Filter bar:** bg `--bsurf`, `border-radius: 12px`, `padding: 12px 16px`, `display: flex; gap: 10px`.
- Text search input (`flex: 1`)
- Estado select (`min-width: 130px`): Todos · Activa · Borrador · Cerrada · Pendiente
- Categoría select (`min-width: 150px`): Todas · Agua y páramos · Bosques · Manglares · Minería

**Table:**

| Column | Width | Notes |
|--------|-------|-------|
| Campaña | `flex: 0 0 300px` | Title 13px 600 + 2-line clamp; region 10.5px `--bmut` |
| Organización | `flex: 0 0 130px` | 12px 500, truncated |
| Progreso | `flex: 0 0 140px` | "count / goal" 12px 600 + mini progress bar (5px height, `--bp` fill) |
| Estado | `flex: 0 0 90px` | Badge (see below) |
| Cierre | `flex: 0 0 90px` | 12px `--bmut` |
| Acciones | `flex: 1` | Right-aligned: Editar · Firmas · **Archivar** |

**Status badge styles:**

| Status | bg | color |
|--------|----|-------|
| activa | `color-mix(in srgb,#18794A 12%,transparent)` | `#18794A` |
| borrador | `#f3f4f6` | `#6b7280` |
| cerrada | `#e8f0fe` | `#1a56db` |
| pendiente | `#fff7ed` | `#c2410c` |

All badges: `padding: 4px 9px`, `border-radius: 99px`, 11px 700, `display: inline-flex`.

**Action buttons per row:**
- **Editar** — outlined, `border: 1.5px solid --bbord`, hover: border+text become `--bp`
- **Firmas** — filled light green `color-mix(in srgb, --bp 10%, transparent)`, text `--bp`
- **Archivar** — outlined red: `border: 1.5px solid color-mix(in srgb,#dc2626 28%,--bbord)`, text `#dc2626`, hover bg `color-mix(in srgb,#dc2626 8%,transparent)`

All action buttons: `min-height: 30px`, `padding: 0 11px`, `border-radius: 8px`, 12px 600.

**Archiving behavior:**
- Archiving is a soft-delete (sets `status = 'archivada'` or `archived_at = now()`).
- Archived campaigns are hidden by default; visible when filter "Cerrada / Archivada" is selected.
- Archived campaigns retain all signature data and history.
- Only Admins can archive any campaign; Gestores can only archive their own and only if it has 0 signatures.

---

### 4 · Editor de campaña (`/admin/campanas/:id/editar`)

Two-column grid: `grid-template-columns: 1fr 280px; gap: 20px`.

**Breadcrumb:** "Campañas ›  Editar campaña" — Campañas is a link (color `--bp`).

**Left column — content cards:**

_Información básica_ card:
- Título: full-width text input
- Categoría (select) + Meta de firmas (number input) — 2-col grid
- Autoridad destinataria: full-width text input

_Contenido_ card:
- "Lo que pedimos" textarea (`rows: 4`), helper "— una demanda por línea"
- "Por qué importa" textarea (`rows: 5`), helper "— descripción completa"

All inputs: `min-height: 44px`, `border-radius: 10px`, bg `--bbg`, `border: 1.5px solid --bbord`. Focus: `border-color: --bp`, `outline: 2px solid color-mix(in srgb, --bp 30%, transparent)`.

**Right column — sidebar cards:**

_Estado de publicación_ card:
- Current status badge (e.g. "Activa") + "Suspender" link in `#dc2626`
- Fecha de inicio + Fecha de cierre (`type="date"` inputs, `min-height: 38px`)

_Documentos_ card (max 5 files):
- Drag-and-drop zone: `border: 2px dashed --bbord`, `border-radius: 10px`, centered text + ↑ icon. Hover: border becomes `--bp`, bg `color-mix(in srgb, --bp 4%, transparent)`
- Uploaded file rows: emoji 📄 + name (truncated) + size + ✕ delete button
- ✕ hover: color `#dc2626`

_Previsualización_ card:
- Single button "Ver campaña pública ↗" — outlined, color `--bp`
- Opens the public campaign URL in a new tab

**Header actions:** "Guardar borrador" (outlined) + "Publicar campaña" (filled `--bp`) — `min-height: 38px`.

---

### 5 · Firmas de campaña (`/admin/campanas/:id/firmas`)

**Breadcrumb:** "Campañas › Firmas registradas".  
**Header actions:** "Exportar CSV" + "Exportar PDF oficial" (both outlined, `min-height: 38px`).

#### KPI cards (4-col grid, `gap: 14px`)

| Card | Color |
|------|-------|
| Total registradas | `--bink` |
| Verificadas | `#18794A` |
| Pendientes confirmación | `#c2410c` (+ alert border) |
| Anónimas / secretas | `--bmut` |

Each: bg `--bsurf`, `border-radius: 12px`, `padding: 16px 18px`. Label: 11px 700 uppercase `--bmut`. Value: Poppins 800 26px.

#### Signatures table

| Column | Width |
|--------|-------|
| # | `flex: 0 0 44px` |
| Nombre | `flex: 0 0 160px` |
| Cédula | `flex: 0 0 110px` |
| Provincia | `flex: 0 0 110px` |
| Visibilidad | `flex: 0 0 100px` |
| Verificación | `flex: 0 0 95px` |
| Fecha | `flex: 1` |
| Acc. | `flex: 0 0 64px` |

**# column:** Poppins 700, color `--bp`.  
**Cédula:** `font-family: 'Inter', monospace`. Always shown masked (`010*****05`) — never expose full cédula in the UI, only in CSV export (admin only, logged action).  
**Anonymous rows:** name shows `—`.

**Visibility badges:**

| Value | bg | color |
|-------|----|-------|
| Pública | `#e8f0fe` | `#1a56db` |
| Anónima | `--bbg` | `--bmut` |
| Secreta | `#f3f4f6` | `#6b7280` |

**Verification badges:**

| State | bg | color |
|-------|----|-------|
| Verificada | `color-mix(in srgb,#18794A 12%,transparent)` | `#18794A` |
| Pendiente | `#fff7ed` | `#c2410c` |

All badges: `padding: 3px 8px`, `border-radius: 99px`, 11px 700.

**Action per row:** "Anular" — outlined, `min-height: 28px`, `border-radius: 7px`. Hover: red text + red border.  
Anulling a signature sets it to `status = 'anulada'` (soft-delete), removes it from the public count, and sends a notification email to the signer.

**Exports:**
- CSV: full data (name, cédula unmasked, email, province, visibility, verification status, date). Only downloadable by Admins and the campaign's Gestor. Action must be server-side logged.
- PDF oficial: formatted document with campaign header, authority address, and table of verified signatures for official submission. Same access rules as CSV.

---

### 6 · Organizaciones (`/admin/organizaciones`)

**Header:** title + "**+ Nueva organización**" button.

**Filter bar:** text search + Estado select (Todos · Verificada · Pendiente · Archivada).

**Table:**

| Column | Width |
|--------|-------|
| Organización (name + domain) | `flex: 0 0 230px` |
| Responsable | `flex: 0 0 140px` |
| Campañas activas | `flex: 0 0 80px` |
| Estado | `flex: 0 0 105px` |
| Registro | `flex: 0 0 100px` |
| Acciones | `flex: 1` |

**Status badges:**

| Status | bg | color |
|--------|----|-------|
| verificada | `color-mix(in srgb,#18794A 12%,transparent)` | `#18794A` |
| pendiente | `#fff7ed` | `#c2410c` |
| archivada | `#f3f4f6` | `#6b7280` |

**Action buttons:** Ver ↗ · Editar · **Archivar** (same red-outlined style as campaigns).

**Verification flow:**
1. Organization registers → status `pendiente`
2. Admin reviews documents/identity → clicks "Verificar" (not shown in prototype — add to the Ver/detail page)
3. Status becomes `verificada` → organization can now publish campaigns
4. Archived organizations (`archivada`): lose panel access, campaigns go to `suspendida` state, signature data is preserved

**"Pendiente" organizations cannot publish campaigns** — enforce at the API level, not just UI.

---

### 7 · Usuarios (`/admin/usuarios`)

**Header:** title + "**+ Invitar usuario**" button.

**Filter bar:** text search + Rol select (Todos · Administrador · Gestor) + Estado select (Todos · Activo · Pendiente · Archivado).

**Table:**

| Column | Width |
|--------|-------|
| Usuario (name + email) | `flex: 0 0 210px` |
| Rol | `flex: 0 0 90px` |
| Organización | `flex: 0 0 170px` |
| Último acceso | `flex: 0 0 120px` |
| Estado | `flex: 0 0 90px` |
| Acciones | `flex: 1` |

**Role badges:**

| Role | bg | color |
|------|----|-------|
| Admin | `#e8f0fe` | `#1a56db` |
| Gestor | `color-mix(in srgb,#18794A 12%,transparent)` | `#18794A` |

**Status badges:**

| Status | bg | color |
|--------|----|-------|
| activo | `color-mix(in srgb,#18794A 12%,transparent)` | `#18794A` |
| pendiente | `#fff7ed` | `#c2410c` |

**Action buttons:** Editar · **Archivar** (same red-outlined style).

**Invite flow:** Admin enters email + assigns role + optionally assigns organization → invite email sent → user completes registration → status changes from `pendiente` to `activo`.

**Archiving users:**
- Sets `archived_at = now()`, revokes session tokens
- User data and activity log are preserved
- Archived users are hidden by default; visible via "Archivado" filter
- An archived user's campaigns are NOT automatically archived — Gestor's campaigns remain active but without an active manager

---

### 8 · Configuración (`/admin/configuracion`)

Two-column layout: `grid-template-columns: 190px 1fr; gap: 24px`.

**Left nav** (sticky, `top: 80px`):
- Card: bg `--bsurf`, `border-radius: 14px`, `padding: 8px`
- Items: `padding: 9px 12px`, `border-radius: 9px`, 13px
  - Active: bg `color-mix(in srgb, --bp 10%, transparent)`, color `--bp`, 700
  - Inactive: bg transparent, color `--bmut`, 500

**Sections (right column):**

_Plataforma:_
- Nombre de la plataforma (text)
- URL base (monospace font)
- Descripción breve (text)
- Correo remitente (email, monospace)

_Notificaciones por correo:_

| Setting | Default |
|---------|---------|
| Nueva firma recibida | ON |
| Meta de firmas alcanzada | ON |
| Nueva organización registrada | ON |
| Campañas próximas a vencer | OFF |

_Toggle spec:_ `42×24px`, `border-radius: 99px`.  
- ON: bg `--bp`, knob at right (`right: 2px`)  
- OFF: bg `--bbord`, knob at left (`left: 2px`)  
Knob: `20×20px` circle, bg `#fff`, `box-shadow: 0 1px 3px rgba(0,0,0,.18)`. Animate knob position with CSS transition `left/right 150ms ease`.

_Seguridad:_

| Setting | Default |
|---------|---------|
| 2FA obligatorio para administradores | ON |
| Cierre de sesión por inactividad (8h) | ON |
| Notificación de inicio de sesión | OFF |

**Save button:** sticky in the page header, "Guardar cambios" — bg `--bp`, `min-height: 38px`. Each section can also have its own save (design does not show this — add if needed for UX clarity).

---

## Archiving — Unified Behavior

Archiving is a **soft-delete** pattern across all three entity types. Rules:

```
archived_at: timestamp | null   # null = not archived
archived_by: uuid (user)        # who did it
```

- Archived items are excluded from default queries (`WHERE archived_at IS NULL`)
- Archived items are visible when filter "Archivados" is selected
- Archived items can be **restored** (set `archived_at = null`) by any Admin
- No hard deletes anywhere in the panel (legal data retention requirements)
- Archiving an Organization suspends (not archives) its active campaigns
- Archiving a User does NOT cascade to their campaigns

---

## RBAC Summary

| Action | Admin | Gestor |
|--------|-------|--------|
| View all campaigns | ✅ | ❌ (own org only) |
| Create / edit campaign | ✅ | ✅ (own org) |
| Archive campaign | ✅ | ✅ (own, 0 firmas) |
| View firmas (any campaign) | ✅ | ❌ (own campaigns) |
| Export CSV / PDF | ✅ | ✅ (own campaigns) |
| Anular firma | ✅ | ✅ (own campaigns) |
| View/edit organizations | ✅ | ❌ |
| Verify organization | ✅ | ❌ |
| Archive organization | ✅ | ❌ |
| Manage users | ✅ | ❌ |
| Platform settings | ✅ | ❌ |

---

## Authentication & Session

- **Session:** JWT or server-side session (your stack's standard)
- **2FA:** TOTP required for Admin role (enforced server-side, not just settings toggle)
- **Session expiry:** 8 hours of inactivity (sliding window)
- **Login notification:** email on each successful panel login
- **Failed login:** lock account after 5 failed attempts, notify by email
- **Password reset:** magic link, expires in 15 minutes
- **Logout:** invalidates server-side session, redirects to `/admin/login`

---

## Data Shapes

```ts
interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'gestor';
  org_id: string | null;   // null for admins
  status: 'activo' | 'pendiente' | 'archivado';
  last_access_at: string;
  archived_at: string | null;
  archived_by: string | null;
}

interface Organization {
  id: string;
  name: string;
  domain: string;
  rep_name: string;
  active_campaigns: number;
  status: 'verificada' | 'pendiente' | 'archivada';
  registered_at: string;
  archived_at: string | null;
}

// Campaign shape: see main README.md
// Signature shape: see main README.md
```

---

## API Endpoints (suggested)

```
POST   /api/admin/auth/login
POST   /api/admin/auth/logout
POST   /api/admin/auth/forgot-password

GET    /api/admin/dashboard          # KPIs + recent activity
GET    /api/admin/campaigns          # ?status=&category=&q=
POST   /api/admin/campaigns
PATCH  /api/admin/campaigns/:id
DELETE /api/admin/campaigns/:id/archive

GET    /api/admin/campaigns/:id/signatures
GET    /api/admin/campaigns/:id/signatures/export/csv
GET    /api/admin/campaigns/:id/signatures/export/pdf
PATCH  /api/admin/signatures/:id/revoke

GET    /api/admin/organizations      # ?status=&q=
POST   /api/admin/organizations
PATCH  /api/admin/organizations/:id
POST   /api/admin/organizations/:id/verify
DELETE /api/admin/organizations/:id/archive

GET    /api/admin/users              # ?role=&status=&q=
POST   /api/admin/users/invite
PATCH  /api/admin/users/:id
DELETE /api/admin/users/:id/archive

GET    /api/admin/settings
PATCH  /api/admin/settings
```

---

## Accessibility

- All interactive elements `min-height: 44px` (except table row actions at 30px — acceptable for desktop admin context)
- `role="navigation"` on sidebar `<nav>`
- Focus visible on all inputs and buttons
- `aria-current="page"` on active nav item
- Tables use `<table>` with `<thead>/<tbody>` (not flex divs) in production — the prototype uses flex for streaming, recreate with semantic HTML
- Keyboard navigation through table rows: `Tab` moves between action buttons
- `aria-label="Cerrar sesión"` on logout button
- Reduced motion: all `animation` and `transition` disabled when `prefers-reduced-motion: reduce`

---

## Files in This Package

| File | Description |
|------|-------------|
| `README.md` | This document |
| `AdminPanel.dc.html` | Interactive prototype — all 8 views, navigable |

Open `AdminPanel.dc.html` directly in a browser. Use the sidebar to navigate between views. The login screen lets you preview both role contexts.
