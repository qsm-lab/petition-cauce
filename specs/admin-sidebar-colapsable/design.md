# Design — admin-sidebar-colapsable

## Archivos afectados

- `apps/web/src/app/admin/AdminSidebarClient.tsx` — agrega estado de colapso,
  toggle, modo solo-iconos con tooltip. Los items `{href, label, icon}` no
  cambian; en modo contraído se oculta `label` y se muestra `icon` centrado con
  `title`/`aria-label`.
- `apps/web/src/app/admin/layout.tsx` — el ancho de la columna reacciona al
  estado (p. ej. clase/variable CSS); el área de contenido ocupa el resto.
- (Opcional) `globals.css` — transición de ancho y estilos del tooltip.

Sin backend, sin migración, sin dependencias nuevas.

## Estado y persistencia (R4)

- Estado `collapsed: boolean` en el cliente. Persistir en
  `localStorage["admin.sidebar.collapsed"]`.
- Para evitar parpadeo en el primer render (SSR → hydration): leer el valor
  antes de pintar (script inline en el layout que setea un `data-` attr / clase
  en el contenedor, o estado inicial derivado en el cliente con `suppressHydra-
  tionWarning`). Patrón: la clase de ancho la aplica el contenedor raíz del
  admin según el valor guardado.

## Interacción visual

- **Expandido**: ancho actual (~210–230px), icono + label.
- **Contraído**: ~64px, solo icono centrado; label vía tooltip (`title` +
  `aria-label`) al hover/focus.
- **Toggle (R3)**: botón con el icono estándar de "toggle panel lateral":
  ```
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2"/>
    <line x1="9" y1="4" x2="9" y2="20"/>
  </svg>
  ```
  Ubicación: en la cabecera del sidebar (junto/bajo el logo) o en su borde
  superior. `aria-expanded` = !collapsed (R7).
- Transición de ancho con `transition` respetando `prefers-reduced-motion` (R6).
- El logo puede reducirse a solo la marca (“C”) en modo contraído.

## Accesibilidad (R7)

- `button` real con `aria-label="Contraer menú"` / `"Expandir menú"` según
  estado y `aria-expanded`. Foco visible. Operable con Enter/Espacio.
- En modo contraído, cada item conserva su `aria-label` (el label textual) para
  lectores de pantalla aunque el texto visual esté oculto.

## Responsive (R8)

- El colapso aplica al layout de escritorio. En breakpoints móviles donde el
  sidebar ya es overlay/oculto, el toggle de colapso no interfiere (se ignora o
  se oculta); no se altera el comportamiento móvil existente.

## Relación con otras features
- `centro-comunicaciones` es el principal beneficiario (R24 de esa spec la
  referencia como dependencia de shell), pero esta feature es independiente y
  se puede implementar y entregar por separado, antes o después.
