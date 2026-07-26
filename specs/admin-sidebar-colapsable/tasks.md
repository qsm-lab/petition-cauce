# Tasks — admin-sidebar-colapsable

> Feature de shell admin, independiente. Frontend puro (sin backend/migración).
> Requiere diseño aprobado (`design-export.html`) por ser frontend.

## Tareas

- [ ] Estado `collapsed` + persistencia en `localStorage["admin.sidebar.collapsed"]`
  sin parpadeo en el primer render (R1, R4).
- [ ] Botón toggle con el **icono estándar de panel lateral** (SVG rect+line),
  `aria-expanded`, `aria-label` según estado, foco visible, teclado (R3, R7).
- [ ] Modo contraído: ancho ~64px, solo iconos (los actuales, sin cambiarlos),
  label vía `title` + `aria-label` (tooltip) (R2, R5).
- [ ] `layout.tsx`: el área de contenido ocupa el ancho liberado; transición
  suave con `prefers-reduced-motion` (R6).
- [ ] Logo reducido a la marca en modo contraído.
- [ ] Verificar en todos los frames del admin (Resumen, Campañas, Firmas,
  Organizaciones, etc.) y en el centro de comunicaciones.
- [ ] Responsive: no romper el comportamiento móvil existente (R8).
- [ ] Tests: toggle/persistencia; solo-iconos con tooltip; sin parpadeo; rutas/
  iconos/orden intactos.

## Cierre
- [ ] Trazabilidad R1..R8 ↔ código ↔ tests.
- [ ] Diseño Claude Design → `design-export.html` (incluido en esta spec).
