# Brief de diseño — Front público + Back-office

> Documento para orientar a **Claude design**. Fecha: 2026-06-27.
> Proyecto: plataforma multi-tenant de campañas de firmas ambientales (apoyo
> ciudadano entregable a autoridades), construida sobre el stack de QSM Forms.
> Referencia de UX/UI: **openPetition.eu** (la más completa). No copiar pixel a
> pixel: tomar su arquitectura de información y traducirla a nuestro sistema.

---

## 0. Cómo usar este documento

Esto es un **brief de producto/diseño**, no de implementación. Describe módulos, pantallas, componentes, estados, contenido e interacciones. El objetivo es que el diseño resuelva **un front estándar único que se adapta a muchas campañas** vía theming, y un **back-office** para crear y administrar esas campañas.

Dos superficies:
- **Front público** (lo que ve el firmante) → §3.
- **Back-office** (lo que usa el administrador de campañas) → §4.

Un principio transversal manda sobre todo: **un solo sistema de componentes, muchas marcas**. El diseño nunca debe ser "a medida por campaña"; debe ser un sistema con tokens que cada campaña personaliza (§2.3).

---

## 1. Principios de diseño

1. **Mobile-first.** La mayoría firmará desde el teléfono, llegando por WhatsApp/redes. El móvil es el diseño primario; el desktop es la ampliación.
2. **Una acción dominante por pantalla.** En la landing pública, firmar gana siempre la jerarquía visual. Todo lo demás es secundario.
3. **Confianza visible.** Quien firma entrega datos personales para un trámite formal: el diseño debe comunicar seriedad, privacidad y destino claro (a qué autoridad va, en qué etapa está).
4. **Adaptable, no rehecho.** Cada campaña cambia color, logo, tipografía e imágenes mediante tokens; la estructura y los componentes no cambian.
5. **Accesible por defecto.** WCAG 2.1 AA como piso, no como extra (§5).
6. **Honestidad en el contenido.** Copy claro sobre qué representa la firma (apoyo ciudadano, no respaldo electoral oficial) y qué pasa con los datos.
7. **Rendimiento como UX.** Carga rápida, sin saltos de layout (CLS), imágenes optimizadas. Un firmante que espera, no firma.

---

## 2. Sistema de diseño y theming multi-campaña

### 2.1 Base heredada (punto de partida)

Se parte del sistema de diseño de QSM Forms (Tailwind exclusivamente, sin CSS-in-JS):
- Tipografía: titulares Montserrat/Poppins; cuerpo Nunito/Inter.
- Botones `rounded-full`, cards `rounded-3xl` (lenguaje orgánico).
- Paleta QSM como tema por defecto (verde `#10A51C`, naranja `#FF5511`, navy `#222F5B`, etc.).

Esto es **el tema base**. Las campañas lo sobrescriben.

### 2.2 Tokens (lo que una campaña puede personalizar)

El diseño debe definirse en términos de **tokens semánticos**, no de colores literales. Cada campaña define sus valores; los componentes consumen los tokens.

| Token | Uso | Ejemplo |
|---|---|---|
| `--brand-primary` | CTA principal (firmar), acentos | naranja, verde, azul océano… |
| `--brand-secondary` | Confirmaciones, badges de éxito | |
| `--brand-ink` | Texto principal, titulares | |
| `--brand-surface` | Fondos de card/secciones | |
| `--brand-bg` | Fondo de página | |
| `--brand-on-primary` | Texto sobre el color primario | blanco/negro según contraste |
| `--font-display` | Titulares | |
| `--font-body` | Cuerpo/UI | |
| `--radius` | Redondez (orgánico vs. sobrio) | |
| `logo`, `hero_image`, `favicon` | Identidad visual | |

Regla dura: **ningún componente usa un hex literal**; todos leen tokens. Así el "front estándar" se vuelve la campaña X o Y solo cambiando el set de tokens (que ya viven en `meta` JSONB por campaña).

### 2.3 Temas de campaña (presets)

Ofrecer 3–4 **presets de tema** listos (p. ej. "Bosque", "Océano", "Páramo", "Neutro") para que una campaña arranque con identidad coherente en segundos, y luego ajuste tokens puntuales. Cada preset = combinación validada de color + tipografía + radio + estilo de imagen, con contraste AA garantizado.

### 2.4 Modo claro/oscuro

Soportar ambos. El tema de campaña define la paleta; el modo solo invierte superficies/texto manteniendo el `--brand-primary` legible en ambos.

---

## 3. Front público — módulos

Arquitectura de información tomada de openPetition, simplificada a nuestro objetivo. Orden vertical en móvil; en desktop, layout de dos columnas (contenido principal + columna lateral de acción/estadísticas).

### 3.1 Página de campaña (la pantalla central)

La pantalla más importante. Estructura recomendada (móvil, de arriba abajo):

1. **Hero**: imagen de la campaña + categoría/tema + título potente. Sobre la imagen, el logo de la organización.
2. **Bloque de acción (sticky en desktop, prominente en móvil):**
   - **Contador de firmas + meta + barra de %** ("191 de 500 · 38%"). Animar el avance.
   - **Destinatario**: "Dirigida a: [autoridad]". Comunica seriedad y destino.
   - **Botón Firmar** (CTA primario, `--brand-primary`).
3. **Indicador de ciclo de vida (5 etapas)**: Lanzada → Recolección → Entrega → Diálogo → Decisión. Etapa actual resaltada; las futuras atenuadas. Es el sello de "esto va a algún lado". (Patrón openPetition.)
4. **Cuerpo de la petición**: el pedido (qué se solicita, en puntos) + la razón/contexto. Tipografía legible, ancho de lectura cómodo (~65–75 caracteres).
5. **Firmas recientes en vivo** (prueba social): lista corta "Nombre, Ciudad · hace X" respetando la **visibilidad** elegida por cada firmante (los "no públicos" aparecen como "Anónimo").
6. **Kit de compartir**: WhatsApp y Telegram primero (contexto Ecuador), luego Facebook/X/email; **enlace corto** copiable y **código QR**. 
7. **Updates / Novedades** de la campaña (si las hay): timeline de avances del trámite.
8. **Mapa de distribución geográfica + apoyo por región** (cuando haya datos): mapa de Ecuador con intensidad por provincia/cantón + tabla "apoyo por región".
9. **Organización iniciadora**: tarjeta con logo, nombre y enlace al perfil.
10. **Descubrimiento**: "También te puede interesar" (otras campañas).

> Columna lateral en desktop: bloque de acción (contador + firmar), detalles de la petición (fechas, región, tema), compartir y estadísticas resumidas. El cuerpo va en la columna principal.

### 3.2 Flujo de firma (el momento crítico)

Debe ser cortísimo y sin fricción. Recomendado: **formulario inline o en panel/modal**, no una página nueva pesada.

- Campos **mínimos** (minimización LOPDP): nombre, email, y los que la autoridad exija (p. ej. cédula, provincia). Nada más.
- **Visibilidad de mi firma**: selector claro *Pública / Anónima / Secreta* con microcopy que explique cada una. Default **Anónima** (privacidad por defecto).
- **Consentimiento**: checkbox **no pre-marcado**, separado, con enlace al aviso de privacidad y mención de la **revocación** ("puedes retirarlo cuando quieras").
- Anti-bot (Turnstile) **invisible**; si aparece, que no rompa el layout (lección QSM: scroll al widget).
- Estados explícitos: enviando, **éxito** ("Revisa tu correo para confirmar" — doble opt-in), y **error con reintento** (nunca fallo silencioso).
- **Confirmación de email (doble opt-in)**: pantalla/estado "Casi listo: confirma desde tu correo". Tras confirmar → pantalla de **gracias** con embudo post-firma.

### 3.3 Pantalla de agradecimiento + embudo post-firma

Tras firmar/confirmar, convertir el momento de mayor compromiso:
- Mensaje de gracias con el contador actualizado.
- **Compartir** (mismo kit) como acción primaria — "tu firma vale el doble si invitas a una persona".
- **Suscribirse a novedades** de la causa (consentimiento separado, opcional, no pre-marcado).
- Sugerencia de otras campañas de la organización.

### 3.4 Páginas de soporte públicas

- **Perfil de organización**: descripción, campañas activas/ganadas, enlace.
- **Listado/Explorar campañas**: filtros por tema y región, búsqueda, estado (activa/entregada/exitosa), ordenar por avance. Card de campaña con imagen, título, % y firmas.
- **Aviso de privacidad / Términos / Accesibilidad**: legibles, por campaña cuando aplique.
- **Páginas de derechos (ARCO)**: cómo acceder, rectificar, eliminar u oponerse; y **revocar consentimiento** (enlace desde el email).
- **Estados vacíos y de error**: 404, campaña cerrada, campaña no encontrada — con salida clara.

### 3.5 Recursos de difusión generados

- **Volante con QR (tear-off) en PDF**: diseño imprimible para pegar en territorio (con QR y enlace corto).
- **Hoja de recolección en papel (PDF)**: formato para juntar firmas a mano (se concilian luego en el back). Diseño claro, columnas para nombre/cédula/firma, encabezado con la campaña y aviso de datos.
- **Widget/banner embebible**: caja de firma compacta para sitios aliados (versión reducida del bloque de acción).

---

## 4. Back-office — módulos

Panel de administración multi-tenant: una organización gestiona sus campañas; el aislamiento por RLS ya existe. Diseño sobrio, denso en información pero ordenado, orientado a tareas.

### 4.1 Estructura general

- **Layout**: navegación lateral (Campañas, Organización, Firmas, Analítica, Cumplimiento, Ajustes) + topbar (org actual, usuario, ayuda).
- **Patrón**: lista → detalle → edición. Acciones primarias visibles, destructivas protegidas (confirmación).
- **Roles y permisos** (mínimo privilegio): un operador ve y gestiona solo las campañas de su organización; nunca las de otra.

### 4.2 Dashboard

- KPIs: firmas totales, campañas activas, % de avance promedio, firmas pendientes de verificación, solicitudes de derechos abiertas.
- Actividad reciente y alertas (campañas cerca de meta, picos de tráfico, intentos de fraude).

### 4.3 Gestión de campañas (CRUD)

Asistente de creación por pasos (wizard), no un formulario gigante:
1. **Básicos**: título, descripción/pedido, razón, categoría/tema, región, autoridad destinataria.
2. **Meta y plazos**: objetivo de firmas, fecha de inicio/cierre.
3. **Campos del formulario**: qué datos se piden (minimización guiada — advertir si se pide de más).
4. **Privacidad**: aviso de privacidad (plantilla editable), base legal, política de retención, visibilidad por defecto.
5. **Branding**: elegir preset de tema + ajustar tokens (color, tipografía, radio), subir logo/hero. **Vista previa en vivo** del front.
6. **Dominio**: asignar dominio/subdominio; estado TLS.
7. **Publicar**: checklist de readiness (privacidad ok, branding ok, dominio ok).

### 4.4 Editor de branding (con preview)

- Panel de tokens (color primario/secundario, tipografías, radio) + carga de logo/hero/favicon.
- **Preview en vivo** lado a lado (móvil + desktop) del front real.
- Validación automática de **contraste AA**; bloquear/advertir combinaciones ilegibles.

### 4.5 Gestión del ciclo de vida

- Avanzar la campaña por etapas (Lanzada → … → Decisión) con fechas y notas.
- Cada cambio de etapa puede gatillar una **actualización (News)** pública y/o aviso a suscriptores.

### 4.6 Gestión de firmas

- Tabla con filtros (estado: pendiente/verificada/rechazada/retirada; región; fecha; origen).
- Estados de cada firma visibles y su motivo si fue rechazada.
- **Conciliación de firmas en papel**: subir lotes capturados del PDF, marcarlos, ligarlos al total. Vista de "digitales vs. papel".
- **Generar lote de entrega**: agrupar verificadas, calcular hash de integridad + sello de tiempo, exportar documento de respaldo (PDF/CSV) con acta de totales.
- Respeto a privacidad: el operador ve lo necesario; exportes auditados.

### 4.7 Organización y taxonomía

- Perfil de la organización (público) + datos internos.
- Gestión de temas/categorías y regiones.
- Miembros del equipo y sus roles.

### 4.8 Cumplimiento LOPDP (módulo de primera clase)

No escondido en ajustes: es central al producto.
- **Solicitudes de derechos (ARCO)**: bandeja para atender acceso/rectificación/supresión/oposición/portabilidad, con SLA y trazabilidad.
- **Revocaciones de consentimiento**: registro y efecto.
- **Retención**: ver/ejecutar políticas de purga/anonimización por campaña.
- **RAT** (Registro de Actividades de Tratamiento) autogenerado y exportable.
- **Runbook de brechas**: checklist y registro de notificaciones (SPDP/ARCOTEL/CSIRT).

### 4.9 Analítica

- Por campaña: evolución de firmas, conversión (visitas → firmas → confirmadas), **origen de firmas (referente)**, distribución por región.
- Analítica **self-hosted (Matomo)**, sin enviar PII a terceros. Respetar consentimiento de cookies/medición.

### 4.10 Difusión y herramientas

- Generar y descargar: enlace corto, QR, volante tear-off (PDF), hoja de recolección (PDF), código del widget embebible.
- Editor de novedades/updates por campaña.
- Gestión de idiomas: español, kichwa, inglés; estado de traducción por campaña (traducción comunitaria).

---

## 5. Accesibilidad y UX — buenas prácticas

- **Contraste AA** mínimo (4.5:1 texto normal, 3:1 texto grande/iconos). Validado en cada preset y en branding custom.
- **Navegación por teclado** completa; foco visible; orden de tabulación lógico; modales con trampa de foco y cierre con Esc.
- **Targets táctiles** ≥ 44×44 px; espaciado suficiente entre acciones (evitar el "ghost touch" ya documentado en QSM).
- **Lectores de pantalla**: HTML semántico, landmarks, `alt` significativos, formularios con `label` asociados, errores anunciados (`aria-live`).
- **Formularios**: validación inline clara, mensajes específicos (no "error genérico"), no perder datos ante un fallo, estados de carga.
- **Movimiento**: respetar `prefers-reduced-motion` (lección QSM: animaciones que no rompen el flujo). Animaciones con propósito, nunca bloqueantes.
- **Internacionalización**: textos externalizados desde el día uno (es/kichwa/en); no hardcodear; soportar longitudes variables.
- **Lenguaje**: claro, en segunda persona, sin jerga legal innecesaria; microcopy que reduzca ansiedad al entregar datos.
- **Estados completos**: cada componente con sus estados de vacío, carga, error y éxito diseñados, no solo el "happy path".

---

## 6. Buenas prácticas de desarrollo (para que el diseño sea construible)

- **Tailwind exclusivamente**, consistente con el stack actual; sin CSS-in-JS.
- **Componentes desacoplados del contenido**: el componente lee tokens y datos; nunca asume una campaña concreta.
- **Server-side rendering del branding**: resolver tokens por `Host`/campaña en el servidor para evitar flash de tema incorrecto (FOUC).
- **Sin saltos de layout (CLS)**: reservar espacio para imágenes/hero; contadores que no empujen contenido al actualizarse.
- **Imágenes optimizadas** (next/image), tamaños responsivos, lazy-load bajo el fold.
- **Estados desde el diseño**: entregar specs de loading/empty/error junto al happy path (alimenta `design-handoff`).
- **Tokens como fuente única de verdad**: documentar el mapa token→uso para que diseño y código no diverjan.
- **Accesibilidad testeable**: incluir criterios AA en el handoff para auditar (alinea con la skill `accessibility-review`).
- **Reutilizar lo endurecido**: Turnstile, manejo de errores de envío, anti-ghost-touch y fixes mobile ya resueltos en QSM — no reinventarlos.

---

## 7. Inventario de componentes (sistema)

Para construir el "front estándar" reutilizable:

| Componente | Dónde se usa | Notas |
|---|---|---|
| `CampaignHero` | landing | imagen + título + logo org + categoría |
| `SignatureCounter` | landing, listado, widget | número + meta + barra %; anima |
| `LifecycleTracker` | landing | 5 etapas; estado actual resaltado |
| `SignButton` / `SignPanel` | landing, widget | CTA + formulario inline/modal |
| `SignForm` | panel/modal | campos mínimos, visibilidad, consentimiento |
| `VisibilitySelector` | sign form | pública/anónima/secreta + microcopy |
| `ConsentCheckbox` | sign form | no pre-marcado, enlace privacidad |
| `RecentSignatures` | landing | respeta visibilidad |
| `ShareKit` | landing, gracias, widget | WhatsApp/Telegram/redes + link corto + QR |
| `RegionMap` | landing, admin | mapa Ecuador + apoyo por región |
| `UpdatesTimeline` | landing | novedades del trámite |
| `OrgCard` | landing, listado | organización iniciadora |
| `CampaignCard` | listado, "te puede interesar" | imagen, %, firmas |
| `ThankYouFunnel` | post-firma | compartir + suscribir |
| `ThemeProvider` | global | inyecta tokens de campaña |
| `AdminTable` | back-office | listas con filtros (firmas, campañas) |
| `CampaignWizard` | back-office | creación por pasos |
| `BrandingEditor` | back-office | tokens + preview en vivo |
| `RightsInbox` | back-office | solicitudes ARCO |
| `BatchExporter` | back-office | lote + hash + sello |

---

## 8. Qué entregar primero (alineado al plan por fases)

Para no diseñar todo de golpe, priorizar lo que desbloquea el MVP (Fase 1) y crece después:

1. **Fase 1**: `ThemeProvider` + tokens, `CampaignHero`, `SignatureCounter` (meta+%), `LifecycleTracker` (vista), `SignPanel`/`SignForm` con `VisibilitySelector` y `ConsentCheckbox`, `RecentSignatures`, `ShareKit` básico, `ThankYouFunnel`, y el shell del back-office (lista de campañas + firmas).
2. **Fase 2**: `BrandingEditor` con preview, `CampaignWizard`, `OrgCard`/perfil, link corto + QR, volante tear-off, `CampaignCard`/explorar.
3. **Fase 3**: `UpdatesTimeline`, suscripción post-firma, `RightsInbox` y vistas de cumplimiento.
4. **Fase 4**: `RegionMap`, conciliación de papel, `BatchExporter`.
5. **Fase 5**: widget embebible, panel de analítica/origen, multi-idioma completo.

---

*Referencia de IA de openPetition usada: arquitectura de la página de campaña (hero, contador+meta, ciclo de vida, cuerpo, firmas recientes, compartir+QR, mapa, organización, descubrimiento), flujo de firma con visibilidad y consentimiento, y herramientas de difusión (PDF de hoja, tear-off, widget). Adaptado a contexto ecuatoriano y a la LOPDP.*
