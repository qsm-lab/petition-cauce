# Requirements — admin-sidebar-colapsable

## Contexto

El admin (`/admin`) tiene una columna de navegación fija
(`apps/web/src/app/admin/AdminSidebarClient.tsx`, montada por
`apps/web/src/app/admin/layout.tsx`) con logo, items `{href, label, icon}`
(Resumen, Campañas, Firmas, Organizaciones, Categorías, Privacidad, Usuarios,
Configuración) y el bloque de usuario/logout. Ocupa un ancho fijo en todos los
frames.

Esta feature agrega la posibilidad de **contraer/expandir** esa columna para
ampliar el área de trabajo. Beneficia a todo el admin y en especial al
**centro de comunicaciones** (`centro-comunicaciones`), cuyo editor +
segmentación + previsualización aprovechan el ancho extra. Feature de shell,
independiente del centro.

## Requisitos

- **R1** El layout admin DEBERÁ permitir **contraer y expandir** el sidebar
  mediante un botón de toggle.
- **R2** En estado **contraído**, el sidebar DEBERÁ mostrar **solo los iconos**
  de cada apartado (los **iconos actuales**, sin cambiarlos), con el label
  accesible por **tooltip** al pasar el cursor y por `aria-label`.
- **R3** El botón de toggle DEBERÁ usar el **icono estándar de "contraer
  panel lateral"** (rectángulo con panel/columna izquierda marcada), no una
  flecha ‹/›.
- **R4** El estado (expandido/contraído) DEBERÁ **recordarse entre sesiones**
  (localStorage) y aplicarse en el primer render sin parpadeo.
- **R5** El colapso NO DEBERÁ cambiar las rutas, el orden ni los iconos
  existentes — solo oculta/expande los labels y ajusta el ancho.
- **R6** La transición de ancho DEBERÁ ser suave y respetar
  `prefers-reduced-motion`.
- **R7** El toggle DEBERÁ ser accesible: foco visible, operable por teclado,
  `aria-expanded` reflejando el estado.
- **R8** En viewport móvil, donde el sidebar ya se comporta como overlay/oculto,
  esta feature NO DEBERÁ romper ese comportamiento (el colapso aplica al modo
  escritorio).

## Fuera de alcance
- Reordenar o personalizar los items del menú.
- Cambiar los iconos actuales.
- Persistencia server-side del estado (localStorage basta).

## Tests
- Toggle contrae/expande y persiste en localStorage (R1, R4).
- Contraído muestra solo iconos con tooltip/aria-label (R2, R7).
- No hay parpadeo de estado en el primer render (R4).
- Rutas/iconos/orden intactos (R5).
