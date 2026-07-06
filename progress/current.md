# Estado actual — tras sesión 19 (2026-07-05)

## Resumen de sesión 19

Rediseño completo del sistema de diseño front-end — zona pública (landing + SignFlow) y zona admin/back-office. Implementado desde cero siguiendo el handoff de Claude Design (`plan/design_handoff_landing_firmante v2/`). TypeScript: 0 errores en todo el proyecto.

---

## Lo que se implementó

### 1. Infraestructura del sistema de diseño (design-system-v2)
- `layout.tsx`: fuentes Anton + Work Sans cargadas vía `next/font/google` (auto-hosteadas en build)
- `globals.css`: tokens CSS actualizados — `--bp` Lime `#D7F24C`, `--bink` Ink `#16261F`, `--bbg` Sage `#EDF4F1`, `--bsec` Green Light `#DCE9E6`, `--bop` Ink sobre Lime, `--br: 14px`
- `tailwind.config.ts`: `font-display` → Anton, `font-body`/`font-heading` → Work Sans
- `src/lib/category-color.ts`: utilidad nueva — deriva color de categoría desde `meta.category_color` o mapa por nombre (Agua/Bosques/Minería/Aire/Suelo/Páramo)

### 2. Landing pública — rediseño completo (zona firmante)
- `CampaignPage.tsx`: fondo sage, nav "Cauce", grid sidebar-primero en DOM (order invertido en desktop con Tailwind), título en color de categoría
- `ActionBlock.tsx`: chip "Dirigida a" full-width (Ink bg + cream text), contador Anton 40px, barra en color de categoría, CTA Lime, CTA flotante mobile, textos secundarios más oscuros (`fontWeight: 500`, opacidad 0.78)
- `Hero.tsx`: badge de categoría top-left, avatar de org top-right, border-radius 20px
- `LifecycleSteps.tsx`: dots horizontales conectados, color de categoría en etapa activa
- `PetitionBody.tsx`: asks en cards blancas con borde Ink; "Por qué importa" en fondo oscuro `#16261F` con heading Lime y texto sage
- `RecentSignatures.tsx`: dot pulsante en color de categoría (`animate-cauce-live-dot`), textos secundarios más visibles
- `RegionBars.tsx`: barras en color de categoría, sin wrapper
- `OrgCard.tsx`: avatar Ink simple, sin botón
- `ShareSection.tsx`: WA en Ink Blue `#12222E`, botones secundarios blancos con borde Ink

### 3. SignFlow — rediseño completo
- `SignFlow.tsx`: backdrop `rgba(18,34,46,.55)` + blur, bottom-sheet mobile / modal desktop (`md:max-w-[520px]`, `rounded-t-[24px] md:rounded-[20px]`)
- `StepForm.tsx`: pills activos con fondo Ink `#16261F` + texto sage (máximo contraste), submit Lime
- `StepSending.tsx`: spinner `animate-pc-spin`, Anton heading
- `StepSuccess.tsx`: "Confirmá tu correo", CTA Lime + secundario blanco con borde Ink
- `StepError.tsx`: círculo `#FBEAE4`/naranja, Lime para reintentar
- `StepThanks.tsx` (nuevo): check en color de categoría, caja crema con contador + barra de progreso, botones de compartir (WA Ink Blue + secundarios), opt-in newsletter con aviso de consentimiento independiente

### 4. Admin — sistema de diseño unificado
- `AdminSidebarClient.tsx`: logo box Lime, item activo Lime `#D7F24C` + Ink text (igual que CTA landing)
- `ui/Button.tsx`: primary = Lime bg + Ink text, `font-body font-bold`, sin sombra verde
- `ui/Badge.tsx`: `active`/`collecting` = Lime + Ink; `draft` = sage; `category` = Green Light + Ink
- 13 páginas admin: eliminados 40+ instancias de `#18794A` hardcodeado y `text-white` sobre fondos Lime
  - Status chips positivos (Activa, Verificada, Confirmada): Green Light `#DCE9E6` + Ink
  - Botones primarios: Lime bg + `color: "var(--bop)"` en todos
  - Links de acción tipo "Firmas →": Lime background + Ink text
  - Breadcrumbs y links secundarios: Ink en lugar de Lime como texto
  - `configuracion/page.tsx`: nav lateral activo con Lime pill

---

## Datos dev

| Campo | Valor |
|-------|-------|
| Email | `admin@cauce.ec` |
| Password | `admin123dev` |
| URL admin | `http://localhost:3002/admin/resumen` |
| URL landing campaña | `http://localhost:3002/?slug=campana-dev-001` |
| Campaña dev ID | `90160ea0-8f05-4605-9fb5-e1af8cc5bf52` |
| Campaña dev status | `active` |

---

## Borradores de commits (pendientes de ejecutar — desde `apps/web/`)

### Commit 1 — Infraestructura
```bash
git add src/app/globals.css src/app/layout.tsx tailwind.config.ts src/lib/category-color.ts

git commit -m "$(cat <<'EOF'
feat: design-system-v2 — fuentes Anton/Work Sans, tokens Ink/Lime/Sage

Carga Anton y Work Sans vía next/font/google (auto-hosteadas en build).
Actualiza CSS custom properties a la nueva paleta: --bp Lime #D7F24C,
--bink Ink #16261F, --bbg Sage #EDF4F1, --bsec Green Light #DCE9E6.
Redirige font-display → Anton y font-body → Work Sans en Tailwind.
Agrega category-color.ts para derivar color de categoría desde meta
o mapa por nombre de causa.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### Commit 2 — Landing pública
```bash
git add "src/app/(campaign)/CampaignPage.tsx" \
        "src/app/(campaign)/components/ActionBlock.tsx" \
        "src/app/(campaign)/components/Hero.tsx" \
        "src/app/(campaign)/components/LifecycleSteps.tsx" \
        "src/app/(campaign)/components/OrgCard.tsx" \
        "src/app/(campaign)/components/PetitionBody.tsx" \
        "src/app/(campaign)/components/RecentSignatures.tsx" \
        "src/app/(campaign)/components/RegionBars.tsx" \
        "src/app/(campaign)/components/ShareSection.tsx"

git commit -m "$(cat <<'EOF'
feat: landing-campana — rediseño completo zona pública (design system v2)

Reescritura total de la landing con el nuevo sistema visual: fondo sage
#EDF4F1, Anton para títulos, Work Sans para cuerpo, color de categoría
dinámico por campaña. Grid sidebar-primero en DOM con order invertido
en desktop. ActionBlock con chip "Dirigida a" full-width y CTA Lime.
PetitionBody con sección "Por qué importa" sobre fondo Ink oscuro.
RecentSignatures con dot pulsante en color de categoría. LifecycleSteps
horizontal con dot activo coloreado. ShareSection con WA en Ink Blue.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### Commit 3 — SignFlow
```bash
git add src/components/sign-flow/SignFlow.tsx \
        src/components/sign-flow/StepForm.tsx \
        src/components/sign-flow/StepSending.tsx \
        src/components/sign-flow/StepSuccess.tsx \
        src/components/sign-flow/StepError.tsx \
        src/components/sign-flow/StepThanks.tsx

git commit -m "$(cat <<'EOF'
feat: sign-flow — rediseño completo (design system v2)

Bottom-sheet en mobile, modal centrado en desktop, backdrop con blur.
Pills activos con contraste máximo: fondo Ink #16261F + texto sage.
Submit Lime. StepThanks nuevo: contador en caja crema, botones de
compartir (WA Ink Blue) y opt-in newsletter con aviso explícito de
consentimiento independiente de la firma.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### Commit 4 — Admin
```bash
git add src/app/admin/AdminSidebarClient.tsx \
        src/app/admin/resumen/page.tsx \
        src/app/admin/campanas/page.tsx \
        src/app/admin/campanas/nueva/page.tsx \
        "src/app/admin/campanas/[id]/CampanaEditorClient.tsx" \
        "src/app/admin/campanas/[id]/firmas/page.tsx" \
        src/app/admin/firmas/page.tsx \
        src/app/admin/organizaciones/OrganizacionesClient.tsx \
        "src/app/admin/organizaciones/[id]/OrgDetailClient.tsx" \
        src/app/admin/politicas-privacidad/PoliticasList.tsx \
        src/app/admin/categorias/CategoriasList.tsx \
        src/app/admin/configuracion/page.tsx \
        src/app/admin/usuarios/page.tsx \
        src/components/ui/Badge.tsx \
        src/components/ui/Button.tsx

git commit -m "$(cat <<'EOF'
feat: admin — sistema de diseño unificado con landing pública (v2)

Sidebar: item activo en Lime + Ink (máximo contraste), logo box Lime.
Botones primarios: Lime bg + Ink text en todos los archivos. Status
chips positivos (Activa, Verificada, Confirmada): Green Light + Ink.
ui/Button primary migrado a Lime, font-body bold. ui/Badge active y
collecting en Lime + Ink. Elimina 40+ instancias de #18794A hardcodeado
y text-white sobre fondos Lime en 13 páginas admin.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Estado de features

| Feature | Estado | Notas |
|---------|--------|-------|
| `harness-setup` | **done** | Completo |
| `infra-fork` | **in_progress** | Local completo; pendiente Cloudflare/VPS/Secrets |
| `ui-design-system` | **done** | V2 — design system v2 aplicado a landing + admin |
| `modelo-base` | **done** | Migración 006 aplicada ✓ |
| `lopdp-base` | **done** | Completo ✓ |
| `multidominio` | **done** | Completo ✓ |
| `anti-fraude-basico` | **done** | Completo ✓ |
| `landing-campana` | **done** | Rediseño v2 ✓ |
| `formulario-firma` | **done** | Submit/confirm/dedup + form_config + Resend ✓ |
| `dashboard-firmas` | **in_progress** | Implementado ✓ (usuario valida) |
| `editor-campana` | **in_progress** | Sesiones 18-19 aplicadas |
| `resumen-admin` | **in_progress** | Implementado ✓ (usuario valida) |
| `perfiles-org` | **in_progress** | Ítems 8-10 ✓; logo_url ✓ |

---

## Pendiente de review manual

1. Landing pública — verificar fidelidad visual con el prototipo `plan/design_handoff_landing_firmante v2/`
2. SignFlow — probar flujo completo: forma → sending → success → thanks con compartir
3. Admin — verificar sidebar Lime activo y chips de estado en todas las páginas

---

## Próxima sesión

### Al inicio
```bash
docker compose -f docker-compose.dev.yml up -d
# No se requieren nuevas migraciones
```

### Continuar con
1. Review manual del rediseño v2 (landing + SignFlow + admin)
2. Ejecutar los 4 commits borradores de sesión 19
3. Cuando todo esté aprobado → avanzar `infra-fork` hacia primer deploy VPS
