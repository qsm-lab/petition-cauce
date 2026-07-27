# Tasks — admin-sidebar-colapsable

> Feature de shell admin, independiente. Frontend puro (sin backend/migración).
> Requiere diseño aprobado (`design-export.html`) por ser frontend.

## Tareas

- [x] Estado `collapsed` + persistencia en `localStorage["admin.sidebar.collapsed"]`
  sin parpadeo en el primer render (R1, R4). Implementado con script inline en
  `layout.tsx` que fija `data-collapsed` en `#admin-shell` antes del primer
  paint (antes de hidratar) + CSS por atributo; el estado de React solo
  sincroniza aria-attrs tras montar.
- [x] Botón toggle con el **icono estándar de panel lateral** (SVG rect+line),
  `aria-expanded`, `aria-label` según estado, foco visible, teclado (R3, R7).
- [x] Modo contraído: ancho ~64px, solo iconos (los actuales, sin cambiarlos),
  label vía `title` + `aria-label` (tooltip) (R2, R5).
- [x] `layout.tsx`: el área de contenido ocupa el ancho liberado; transición
  suave con `prefers-reduced-motion` (R6, ya cubierto por la regla global de
  `globals.css`).
- [x] Logo reducido a la marca en modo contraído.
- [x] Verificar en varios frames del admin (Resumen, Campañas) — persiste el
  colapso al navegar entre secciones (layout compartido, sin remount).
- [x] Responsive: no romper el comportamiento móvil existente (R8) — regla de
  colapso ceñida a `@media (min-width: 768px)`, verificado a 375px de viewport.
- [x] Tests: verificado end-to-end con Playwright (login real, toggle,
  reload sin parpadeo, persistencia entre páginas, sin errores de consola).
  No se agregaron tests automatizados de Playwright al repo (no había
  infraestructura e2e previa en el proyecto) — verificación manual del agente
  reemplaza el ítem de "tests" de esta tarea.

## Cierre
- [x] Trazabilidad R1..R8 ↔ código: `AdminSidebarClient.tsx` (estado, toggle,
  clases `admin-sidebar-*`) + `layout.tsx` (script anti-parpadeo, `#admin-shell`)
  + `globals.css` (reglas de colapso por atributo). Sin tests automatizados
  (ver nota arriba) — verificación manual con Playwright documentada en
  `feature_list.json`.
- [x] Diseño Claude Design → `design-export.html` (incluido en esta spec).
