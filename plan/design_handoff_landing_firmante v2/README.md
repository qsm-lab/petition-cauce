# Handoff: Landing pública de campaña (Cauce) — flujo del firmante

## Overview
Cauce es una plataforma multi-tenant de recolección de firmas digitales para activismo ambiental en Ecuador. Este handoff cubre **únicamente la zona pública de cara al ciudadano firmante**: la landing de una campaña y el flujo superpuesto de firma (SignFlow). La zona de administración (login, dashboard, editor de campañas, etc.) **no está incluida** — se diseña en una fase posterior.

El objetivo de esta landing es que el ciudadano entienda la causa, confíe en ella y firme con la menor fricción posible, y que cada firmante se convierta en difusor de la campaña.

## About the Design Files
Los archivos `.dc.html` de esta carpeta son **prototipos de referencia construidos en HTML/React** para explorar y validar diseño e interacción — **no son código de producción para copiar tal cual**. Usan un runtime propio de prototipado (`support.js`, no incluido) que no existe en una app real.

La tarea es **recrear este diseño en el stack real del proyecto** (React/Next, Vue, mobile nativo, etc.) usando los patrones y librerías ya establecidos en ese codebase. Si el proyecto aún no tiene un framework de frontend definido, elegir el que mejor se ajuste (recomendado: React + Tailwind o CSS-in-JS, dado que el diseño es 100% estilos inline/utilitarios sin dependencias de un design system previo).

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciados, componentes y estados están definidos y deben recrearse con precisión. El contenido de campaña (título, organización, cifras, firmas recientes, regiones) es **contenido de ejemplo/placeholder** — debe conectarse a datos reales de la API de campañas.

## Archivos de este bundle

| Archivo | Contenido |
|---|---|
| `Landing de Campaña.dc.html` | Prototipo principal: landing responsiva (desktop + mobile en un solo archivo) + SignFlow completo (formulario, envío, confirmación pendiente, error, gracias). |
| `Landing de Campaña - Móvil.dc.html` | La misma landing montada dentro de un frame de iPhone, solo para visualizar la versión mobile aislada. No es una implementación distinta — es el mismo componente. |
| `Sistema de Diseño - Análisis.dc.html` | Documento de referencia con la paleta, tipografía y catálogo de componentes reutilizables (de dónde sale cada decisión visual). |
| `brief-front-nuevo-sistema.md` | Brief funcional completo de la plataforma (todas las pantallas, componentes y reglas de negocio — pública y admin), con la sección 9 (sistema de diseño) ya incorporada. **Es la fuente de verdad funcional**; este README cubre el detalle de implementación de la landing pública. |
| `ios-frame.jsx` | Bezel de iPhone usado solo para la vista mobile de referencia; no forma parte del producto. |

## Screens / Views

### 1. Landing de campaña (Frame 1)
**Propósito:** el ciudadano llega, evalúa la causa y decide firmar.

**Layout (desktop, ≥760px):**
- Contenedor máximo 1148px, centrado, padding lateral 24px.
- Nav simple: wordmark "Cauce" (Anton 22px) a la izquierda + subtítulo "Plataforma de firmas ciudadanas" a la derecha (13px, ink al 55% opacidad).
- Hero: imagen de fondo, `border-radius:20px`, altura `clamp(260px, 42vw, 420px)`. Degradado oscuro de abajo hacia arriba (`linear-gradient(to top, rgba(22,38,31,.88), transparent 58%)`) para legibilidad. Badge de categoría (pill blanco, esquina superior izq.) y avatar circular con inicial de la organización (fondo tinta, esquina superior der., 44×44px).
- Título de la petición: Anton, `clamp(32px,4.6vw,52px)`, color = color de categoría (ver Design Tokens), max-width 820px.
- Línea "Impulsada por {organización}" debajo del título.
- Grid principal: 2 columnas `minmax(0,1.6fr) minmax(300px,1fr)`, gap 32px. Columna izquierda = contenido; columna derecha = panel de acción, `position:sticky; top:20px`.

**Layout (mobile, <760px):** grid pasa a **1 columna**; el panel de acción (ActionBlock + OrgCard + ShareSection) se reordena con CSS `order:-1` para aparecer **primero**, antes del cuerpo de la petición — replicando el patrón típico de petition pages donde el CTA de firma es lo primero que se ve en mobile. El panel deja de ser sticky (`position:static`).

**Columna principal (orden de arriba a abajo):**
1. **LifecycleSteps** — 5 etapas fijas: Lanzada, Recolección, Entrega, Diálogo, Decisión. Puntos de 32px conectados por una línea de 2px. Etapa completada = círculo relleno tinta + "✓"; etapa actual = círculo relleno con el color de categoría; etapas futuras = círculo blanco con borde tinta 2px + número. Label bajo cada punto (12px; peso 700 y opacidad 100% en la etapa actual, peso 500 y opacidad 55% en el resto).
2. **"Lo que pedimos"** (asks) — título Anton 26px. Lista de tarjetas: fondo blanco, borde 1.5px tinta, radius 14px, padding 16/18px. Cada tarjeta tiene un número circular (26px, fondo color de categoría, texto blanco) + texto (16px/1.5).
3. **"Por qué importa"** — título Anton 26px + párrafos 17px/1.65, color tinta al 82%.
4. **Documentos adjuntos** (si existen) — tarjetas fondo blanco/borde tinta con nombre + tamaño de archivo.
5. **RecentSignatures** — título Anton 24px + punto animado (pulso, color de categoría, `@keyframes` box-shadow expandiéndose, 1.8s loop) junto al título. Lista en una tarjeta con borde tinta; cada fila: avatar (34px círculo, inicial sobre color de categoría si es pública; ícono de candado sobre fondo gris si es anónima/secreta) + nombre/estado + provincia + tiempo relativo. Nota de privacidad al pie (12px, tinta 45%).
6. **RegionBars** — título Anton 24px. Por cada provincia: nombre + porcentaje (14px/700) y barra de progreso (8px alto, fondo tinta al 10%, relleno con el color de categoría — **no usar tinta oscura plana para el relleno**, debe ser un color vivo).

**Panel de acción (sidebar):**
1. **ActionBlock** — tarjeta blanca, borde 1.5px tinta, radius 18px, padding 24px.
   - Chip "Dirigida a" con ícono de bandera (círculo 28px con un ícono simple de bandera en dos trazos) + label pequeño "DIRIGIDA A" (10px, uppercase, opacidad 65%) sobre el nombre de la autoridad (13px/700) — todo dentro de una píldora de fondo tinta y texto crema.
   - Contador grande: Anton 40px (número de firmas actuales) + "de {objetivo} firmas objetivo" (14px, tinta 60%).
   - Barra de progreso funcional (10px alto, relleno = color de categoría, ancho = % real).
   - **Botón "Firmar esta petición"**: fondo lima `#D7F24C` — **este color no se usa en ningún otro elemento del sistema**, es exclusivo del CTA de firma (ActionBlock, CTA flotante mobile, submit del formulario). Texto tinta 700, 18px, pill (`border-radius:30px`), padding 18px/24px.
     - Si la campaña está cerrada: texto "Campaña cerrada", `disabled`, opacidad 0.5.
     - Si está en modo borrador: texto "Firmar (modo prueba)".
   - Texto de garantía de privacidad (12px, tinta 50%).
2. **OrgCard** — tarjeta blanca, avatar circular 46px (fondo tinta, inicial) + "Organización" (12px, tinta 50%) + nombre (16px/700).
3. **ShareSection** — tarjeta blanca:
   - Botón "Compartir por WhatsApp": ancho completo, fondo `#12222E` (tinta azul — **no negro**), texto blanco 700, con ícono de burbuja de chat genérico (dos formas CSS simples, no el logo real de WhatsApp por ser marca registrada).
   - Fila de 3 botones secundarios (Facebook / X / Email): blanco, borde tinta, texto tinta 600.
   - Bloque de URL copiable: fondo crema, texto truncado + botón "Copiar enlace" (cambia a "¡Copiado!" 1.5s tras el clic).

**Banner de borrador:** si `is_draft = true`, barra `sticky top:0` ancho completo, fondo dorado `#F2C230`, texto tinta 700: "Campaña en revisión · las firmas realizadas aquí son de prueba y no se contabilizarán".

**CTA flotante mobile:** cuando el ActionBlock sale del viewport (detectado con `IntersectionObserver`) y el viewport es mobile, aparece una barra fija en la parte inferior (fondo crema, borde superior tinta 1.5px) con el conteo de firmas + el mismo botón lima de firmar. Se oculta si la campaña está cerrada o si el modal está abierto.

### 2. SignFlow — panel superpuesto (Frames 2–5)
**Propósito:** capturar la firma sin navegar a otra página.

**Contenedor:** backdrop `rgba(18,34,46,.55)` + `backdrop-filter: blur(3px)`, clic fuera o tecla Escape cierran el modal. `role="dialog"` `aria-modal="true"`.
- **Desktop:** diálogo centrado, ancho 520px, `border-radius:20px`, `max-height:90vh`.
- **Mobile:** hoja deslizada desde abajo (`align-items:flex-end`), ancho 100%, esquinas superiores redondeadas (`24px 24px 0 0`), `max-height:88vh`.
- Botón de cierre "✕" circular arriba a la derecha.

**Step 1 — Formulario (StepForm):**
- Eyebrow con el título de la campaña + H2 "Firmar esta petición" (color = color de categoría).
- **Tipo de firmante**: 2 píldoras excluyentes (Persona natural / Organización). Activa: fondo verde claro `#DCE9E6`, texto tinta; inactiva: blanco + borde tinta.
- Si "Organización": input "Nombre de la organización" (aparece condicionalmente).
- Input "Nombre completo *" (obligatorio).
- Input "Correo electrónico *" (obligatorio, valida formato email).
- **Ubicación**: 2 píldoras (Ecuador / Internacional). Si Ecuador → select de provincia (las 24 provincias + "Otra", ver lista completa en el brief). Si Internacional → input de país libre.
- Input "Cédula (opcional)" — fondo blanco explícito (para diferenciarse del resto del formulario).
- **Visibilidad de tu firma**: 3 píldoras excluyentes (Pública / Anónima / Secreta) — nunca un desplegable ni texto pequeño. Activa "Pública" usa el color de categoría (vivo) de fondo + texto blanco; el resto de píldoras del formulario usan el patrón tinta-oscura-activa / blanco-inactiva.
- Checkbox de consentimiento LOPDP + link al aviso de privacidad (obligatorio, adyacente al checkbox, nunca oculto).
- Nota de verificación anti-bot: **solo texto**, sin checkbox ni espacio reservado visible (el widget real —Cloudflare Turnstile— es invisible).
- Botón submit (mismo estilo lima que el CTA de firma), deshabilitado hasta que nombre + email válido + consentimiento estén completos.

**Step 2 — Enviando (StepSending):** spinner circular (borde 4px, animación de rotación 0.8s) + texto "Enviando tu firma…". Sin acciones.

**Step 3 — Confirmación pendiente (StepSuccess):** ícono de sobre + "Confirmá tu correo" + email al que se envió + botón "Ya confirmé — continuar" (lima) + botón secundario "Reenviar correo de confirmación" (estados: idle → "Enviando…" → "Correo reenviado").

**Step 4 — Error (StepError):** ícono de alerta + mensaje específico según el tipo de error (ver tabla abajo) + botón "Reintentar" (lima, mantiene los datos) + botón secundario "Editar mis datos" (vuelve al Step 1 sin perder lo ingresado).

Tipos de error y copy exacto:
| Tipo | Mensaje |
|---|---|
| Ya firmaste | "Ya registramos una firma tuya en esta campaña." |
| Cédula inválida | "La cédula ingresada no es válida. Revísala e inténtalo de nuevo." |
| Rate limit | "Demasiados intentos. Esperá unos minutos e inténtalo de nuevo." |
| Sin conexión | "No pudimos conectar. Revisá tu conexión e inténtalo de nuevo." |

**Step 5 — Gracias (StepThanks):** check circular (color de categoría) + "¡Gracias, {nombre}!" + contador actualizado (actual + 1) con barra de progreso + botones de compartir (mismo patrón que ShareSection, WhatsApp primero en tinta azul) + checkbox opt-in newsletter **separado** del consentimiento de firma, con aclaración explícita de que es un consentimiento independiente.

## Interactions & Behavior
- **Breakpoint responsivo:** NO usar `window.matchMedia`/viewport — el prototipo mide el **ancho del propio contenedor raíz** con `ResizeObserver` y considera "mobile" por debajo de 760px. Esto es intencional para que el layout responda igual si el componente se embebe en un contenedor angosto (ej. un iframe o panel) y no solo cuando la ventana del navegador es angosta. Replicar este criterio (o el equivalente de contenedor en el framework elegido) en vez de un media query puro, si el componente puede vivir embebido.
- **CTA flotante:** `IntersectionObserver` sobre el nodo del ActionBlock; se muestra cuando deja de intersectar el viewport, solo en mobile, solo si el modal está cerrado y la campaña no está cerrada.
- **Cierre de modal:** clic en el backdrop, tecla `Escape`, o botón "✕". El clic dentro del panel no debe propagar al backdrop (`stopPropagation`).
- **Validación de submit:** habilitado solo si `fullName` no vacío + email con formato válido + checkbox de consentimiento marcado.
- **Simulación de envío:** en el prototipo, un `setTimeout` de ~1.2s pasa de "enviando" a "pendiente" (o a "error" si se fuerza un tipo de error). En producción esto es una llamada real a la API de firmas.
- **Reintentar tras error:** vuelve a "enviando" y luego a "pendiente" (en producción, reintenta la llamada real con los mismos datos ya capturados).
- **Copiar enlace:** feedback visual de 1.5s ("¡Copiado!") antes de volver al label original.
- **Reenviar correo:** botón deshabilitado mientras está en estado "enviando".
- Accesibilidad: `role="dialog"` + `aria-modal="true"` en el overlay. Falta implementar **focus trap** completo (mencionado como requisito funcional en el brief, no resuelto a fondo en el prototipo).

## State Management
Estado necesario para el flujo (nombres orientativos, adaptar a la convención del codebase):
- `isMobile: boolean` — derivado del ancho del contenedor.
- `modalOpen: boolean`
- `step: 'form' | 'sending' | 'pending' | 'error' | 'thanks'`
- Datos del formulario: `signerType`, `orgName`, `fullName`, `email`, `locationType`, `province`, `country`, `cedula`, `visibility`, `consent`
- `resendState: 'idle' | 'sending' | 'sent'`
- `copyState: 'idle' | 'copied'`
- `newsletterOptIn: boolean`
- `showFloatingCTA: boolean`

Datos de campaña que deben venir de la API (no hardcodear): categoría + color asociado, organización (nombre + logo/inicial), título de la petición, autoridad destinataria, meta y conteo de firmas, etapa del ciclo de vida, asks[], cuerpo narrativo, firmas recientes[], distribución regional[], adjuntos[], flags `is_draft` / `is_closed`, y la `form_config` que determina qué campos del formulario son obligatorios/visibles por campaña (ver sección 5.3 del brief).

## Design Tokens

### Colores
| Token | Hex | Uso |
|---|---|---|
| Crema fondo | `#FBF0E6` | Fondo base de toda la landing |
| Verde-azulado sección | `#DCE9E6` | Fondos alternos, píldora activa "tipo de firmante" |
| Tinta verde | `#16261F` | Texto principal, bordes, superficies oscuras |
| Tinta azul | `#12222E` | Variante de superficie oscura (botón WhatsApp, degradados) |
| **Lima (reservado)** | `#D7F24C` | **Solo** botón de firmar / CTA flotante / submit |
| Categoría · Agua | `#2B4EEA` | Ejemplo de color de categoría (varía por campaña) |
| Categoría · Bosques | `#3F8F5C` | — |
| Categoría · Minería | `#FF5A2B` | — |
| Badge de progreso | `#F2C230` | Banner de borrador |

Los fondos de tinta (verde/azul) usan un degradado sutil del mismo tono (ej. `linear-gradient(150deg, #1B2E24 0%, #16261F 45%, #0F1C17 100%)`), nunca un color plano.

### Tipografía
- **Display — Anton** (Google Fonts): H1/H2, condensada, alto impacto. Tamaños: H1 landing `clamp(32px,4.6vw,52px)`; H2 de sección 24–26px; contador ActionBlock 40px.
- **Texto — Work Sans** (Google Fonts, pesos 400/500/600/700/800): cuerpo, formularios, labels. Mínimo 18–19px en cuerpo de petición y formulario; 13–16px para labels/meta.

### Radios y bordes
- Tarjetas: `border-radius: 14–18px`, borde `1.5px solid #16261F`.
- Píldoras/botones: `border-radius: 24–30px` (pill completo).
- Hero: `border-radius: 20px`.

### Sombras
- Modal: `box-shadow: 0 20px 60px rgba(22,38,31,.3)`.
- CTA flotante: `box-shadow: 0 -4px 16px rgba(22,38,31,.1)`.

## Assets
- **Foto de hero**: placeholder (patrón rayado CSS) — reemplazar por la imagen de impacto real de cada campaña (desktop y mobile pueden diferir, según el brief).
- **Logo/inicial de organización**: placeholder con inicial en círculo — reemplazar por el logo real cuando exista.
- Ningún ícono de marca (WhatsApp, Facebook, X) fue recreado con el logo oficial; se usaron formas genéricas. El equipo de desarrollo debe usar los ícono-kits oficiales de cada red (respetando sus lineamientos de marca) o los iconos ya disponibles en el codebase.

## Referencia funcional completa
Para reglas de negocio, catálogo completo de componentes (incluida la zona admin, fuera de este handoff) y restricciones funcionales no-negociables (formulario no navega, CTA siempre visible en mobile, Turnstile no-interactivo, opt-in de newsletter separado, visibilidades excluyentes, etc.), ver `brief-front-nuevo-sistema.md`, sección 8.
