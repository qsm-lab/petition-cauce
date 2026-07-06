# Brief de front — nuevo sistema de diseño
> Documento de referencia funcional. Describe QUÉ existe y PARA QUÉ sirve cada pieza.
> No prescribe estilos, colores, tipografía ni layout. Es la base para diseñar desde cero.

---

## 1. Propósito y objetivo de la plataforma

**Cauce** es una plataforma multi-tenant de recolección de firmas digitales para activismo ambiental en Ecuador. Permite a organizaciones de la sociedad civil lanzar campañas de presión ciudadana dirigidas a autoridades públicas o privadas.

### Objetivo central
Conectar a ciudadanos con causas ambientales, facilitar su participación con el mínimo de fricción posible y entregar el respaldo acumulado (firmas + evidencia) a la autoridad destinataria con valor probatorio.

### Propósito de la experiencia pública
1. **Informar** — qué se pide y por qué importa.
2. **Convencer** — prueba social (cuántos ya firmaron) y legitimidad (quién organiza).
3. **Activar** — capturar la firma con el menor número de pasos posible.
4. **Multiplicar** — hacer que cada firmante invite a más personas.

### Contexto legal
La plataforma opera como **Encargado del tratamiento** bajo la LOPDP Ecuador. Toda campaña requiere un contrato de encargo firmado con la organización cliente (Responsable). Los datos de los firmantes se usan únicamente para respaldar el trámite ante la autoridad declarada y son eliminados o anonimizados según la política de retención de cada campaña.

---

## 2. Mapa de pantallas

### Zona pública (ciudadano anónimo)

| Pantalla | Ruta | Descripción |
|----------|------|-------------|
| Landing de campaña | `/?slug=<slug>` o dominio propio | Página principal de la campaña. Todo el flujo de firma ocurre aquí. |
| Confirmación de firma | `/c/<slug>/gracias` | Pantalla post-clic en enlace de email. Registra la firma como válida. |
| Aviso de privacidad | `/aviso-de-privacidad` | Texto legal completo. Abre desde el formulario de firma. |

### Zona admin (administrador autenticado)

| Pantalla | Propósito |
|----------|-----------|
| Login | Acceso con credenciales. |
| Resumen | Dashboard con KPIs globales de la plataforma. |
| Campañas | Listado de campañas. |
| Editor de campaña | Crear y editar todos los campos de una campaña. |
| Firmas de campaña | Ver, filtrar y exportar firmas de una campaña concreta. |
| Vista global de firmas | Tabla de todas las campañas con conteo de firmas y acceso directo. |
| Organizaciones | CRUD de organizaciones cliente. |
| Categorías | CRUD de categorías temáticas. |
| Políticas de privacidad | CRUD de textos de aviso de privacidad y contratos LOPDP. |

---

## 3. Flujo principal — landing hasta difusión post-firma

El flujo completo sucede en una sola URL (la landing de campaña). El formulario de firma se abre como un panel superpuesto (modal/sheet) sin navegar a otra página, salvo la confirmación por email.

```
┌─────────────────────────────────────────┐
│  FRAME 1 — Landing de campaña           │
│  El ciudadano llega y evalúa la causa   │
└───────────────┬─────────────────────────┘
                │  Clic en "Firmar"
                ▼
┌─────────────────────────────────────────┐
│  FRAME 2 — Formulario de firma          │
│  Captura de datos + consentimiento      │
└───────────────┬─────────────────────────┘
                │  Submit
                ▼
┌─────────────────────────────────────────┐
│  FRAME 3 — Enviando                     │
│  Estado de carga mientras se procesa    │
└───────────────┬─────────────────────────┘
                │
          ┌─────┴──────┐
          ▼            ▼
   ┌──────────┐  ┌──────────────────┐
   │ FRAME 4a │  │    FRAME 4b      │
   │  Error   │  │ Éxito: pendiente │
   │          │  │ de confirmación  │
   └──────────┘  └────────┬─────────┘
                          │  El usuario
                          │  hace clic en
                          │  email de confirmación
                          ▼
               ┌─────────────────────────┐
               │  FRAME 5 — Gracias      │
               │  Firma registrada.      │
               │  Contador actualizado.  │
               │  Invitar contactos.     │
               │  Opt-in newsletter.     │
               └─────────────────────────┘
```

### Detalle de cada frame

#### Frame 1 — Landing de campaña
**Objetivo:** Que el ciudadano entienda la causa, confíe en ella y quiera firmar.

Información que debe transmitir:
- Imagen de impacto (visual de la causa)
- Categoría de la campaña (ej. Agua, Minería, Bosques)
- Organización que impulsa la campaña (credibilidad)
- Título de la petición (la demanda concreta)
- Qué se pide exactamente (lista de demandas)
- Por qué importa (contexto narrativo)
- Cuántas personas ya firmaron (prueba social)
- Quién es la autoridad destinataria (legitimidad del trámite)
- Objetivo de firmas y avance hacia él (urgencia / momentum)
- Etapa del ciclo de vida de la campaña (transparencia del proceso)
- Firmas recientes en tiempo real (actividad viva)
- Cómo compartir la campaña (multiplicación)
- Documentos adjuntos descargables (evidencia de fondo)
- Distribución geográfica de apoyos (representación territorial)

Acción principal: abrir el formulario de firma.

#### Frame 2 — Formulario de firma
**Objetivo:** Capturar los datos del firmante con el menor roce posible y obtener consentimiento LOPDP válido.

Campos que contiene:
- Tipo de firmante (persona natural u organización)
- Nombre de la organización (si aplica)
- Nombre completo del firmante (obligatorio siempre)
- Correo electrónico (obligatorio — usado para doble opt-in)
- Ubicación: Ecuador (provincia) o Internacional (país libre)
- Cédula / número de identificación (obligatorio o opcional según la campaña)
- Visibilidad elegida: pública / anónima / secreta
- Checkbox de consentimiento LOPDP con enlace al aviso de privacidad
- Widget anti-bot (Turnstile Cloudflare, no-interactivo)
- Botón de submit

Notas funcionales importantes:
- Los campos mostrados y cuáles son obligatorios son configurables por campaña (form_config).
- El consentimiento y el widget deben estar marcados/completados para habilitar el submit.
- La visibilidad elegida determina cómo aparece la firma en el feed público.

#### Frame 3 — Enviando
**Objetivo:** Informar al usuario que su solicitud está siendo procesada. Evitar que intente de nuevo.

Contenido: indicador de progreso / carga. Sin acciones disponibles.

#### Frame 4a — Error
**Objetivo:** Explicar qué salió mal y dar salida sin perder los datos.

Tipos de error posibles:
- Ya firmaste esta campaña (deduplicación)
- Cédula inválida
- Cédula requerida y no enviada
- Anti-bot falló
- Rate limit (demasiados intentos)
- Sin conexión

Acciones: reintentar con los mismos datos / volver a editar el formulario.

#### Frame 4b — Firma enviada, pendiente de confirmación
**Objetivo:** Explicar que la firma aún no está registrada hasta hacer clic en el correo de verificación. Gestionar el caso de que el correo no llegue.

Información: a qué correo se envió el enlace.

Acciones:
- "Ya confirmé → continuar" (avanza a Frame 5)
- "Reenviar correo de confirmación"

#### Frame 5 — Gracias / difusión post-firma
**Objetivo:** Celebrar la acción del firmante y convertirlo en difusor de la campaña.

Contenido:
- Confirmación personalizada (nombre del firmante)
- Nuevo total de firmas (el firmante ve el impacto inmediato de su acción)
- Progreso hacia el objetivo
- Botones para compartir la campaña: WhatsApp, Facebook, X (Twitter), Email
- Texto de difusión predefinido (configurable por la organización) para facilitar el copy-paste
- Opt-in newsletter (consentimiento separado, no vinculado a la firma)

---

## 4. Catálogo de componentes — zona pública

### Relevancia

| Nivel | Significado |
|-------|-------------|
| **Crítico** | Sin este componente la funcionalidad principal se rompe o el propósito de la pantalla no se cumple |
| **Alto** | Contribuye directamente a la conversión o a la credibilidad de la causa |
| **Medio** | Enriquece la experiencia y la confianza, pero su ausencia no bloquea la acción |
| **Bajo** | Complementario; puede diferirse a versiones futuras del diseño |

---

### 4.1 Hero (imagen de portada)

**Propósito:** Primera impresión visual. Genera el vínculo emocional con la causa antes de leer cualquier texto. Transmite el territorio, la naturaleza o el conflicto en cuestión.

**Relevancia:** Alto

**Contenido funcional:**
- Imagen de fondo (desktop y versión mobile independientes)
- Gradiente de oscurecimiento en la parte inferior para garantizar legibilidad del texto superpuesto
- Badge de categoría de la campaña (ej. "Agua", "Bosques")
- Logo o inicial de la organización impulsora (anclado en una esquina)
- Fallback visual cuando no hay imagen cargada

**Comportamiento:** Estático. Solo renderiza; no tiene acciones.

---

### 4.2 Título de la petición

**Propósito:** Expresa en pocas palabras la demanda central. Es el elemento de mayor jerarquía textual de toda la landing.

**Relevancia:** Crítico

**Contenido funcional:**
- Texto: el `petition_title` de la campaña
- Visible inmediatamente bajo el Hero (en mobile) o en la columna principal (desktop)

---

### 4.3 ActionBlock (bloque de acción)

**Propósito:** Es el motor de conversión. Concentra toda la información de momentum (cuántos firmaron, objetivo) y el botón principal de firma.

**Relevancia:** Crítico

**Contenido funcional:**
- Contador de firmas en número grande
- Texto "de X firmas" (objetivo, si está activo)
- Barra de progreso animada hacia el objetivo
- Chip con la autoridad destinataria ("Dirigida a: Ministerio del Ambiente")
- Botón principal de acción:
  - Activo: "Firmar esta petición"
  - Modo borrador: "Firmar (modo prueba)"
  - Campaña cerrada: estado inactivo con texto "Campaña cerrada"
- Texto de garantía de privacidad (confirmación por correo, privacidad por defecto)
- CTA flotante en mobile: aparece cuando el ActionBlock sale del viewport, permitiendo firmar desde cualquier punto de la página sin necesidad de hacer scroll de vuelta

**Comportamiento:** Al hacer clic en el botón de acción → abre SignFlow (Frame 2).

---

### 4.4 LifecycleSteps (ciclo de vida)

**Propósito:** Muestra en qué etapa del proceso se encuentra la campaña. Aporta transparencia sobre el estado del trámite y establece expectativas reales.

**Relevancia:** Medio

**Etapas (fijas, en orden):**
1. Lanzada
2. Recolección
3. Entrega
4. Diálogo
5. Decisión

**Contenido funcional:**
- Indicador visual de las 5 etapas en línea horizontal
- Etapa actual resaltada visualmente; etapas anteriores marcadas como completadas
- Barra de progreso entre etapas

---

### 4.5 PetitionBody (cuerpo de la petición)

**Propósito:** Presenta el argumento de la causa. Convence al ciudadano indeciso.

**Relevancia:** Alto

**Dos secciones internas:**

**"Lo que pedimos"** (asks)
- Lista ordenada de demandas concretas (máx. 5)
- Cada ítem es una demanda específica dirigida a la autoridad
- Propósito: claridad total sobre qué se exige

**"Por qué importa"** (petition_body)
- Texto narrativo enriquecido (puede incluir formato HTML básico: párrafos, negritas, listas)
- Propósito: contexto emocional y factual que justifica la causa
- Puede ser ausente si la campaña es muy concreta

---

### 4.6 RecentSignatures (firmas recientes)

**Propósito:** Prueba social en tiempo real. Ver que otros están firmando ahora genera urgencia y confianza.

**Relevancia:** Alto

**Contenido funcional:**
- Indicador "en vivo" (pulso animado)
- Lista de hasta 10 firmas recientes: nombre visible o "Anónimo", provincia, tiempo transcurrido
- Para firmas anónimas o secretas: se muestra un avatar neutro con candado
- Se actualiza automáticamente cada 30 segundos (polling)
- Estado vacío: "Sé el primero en firmar" si no hay firmas aún
- Nota de privacidad al pie explicando la visibilidad elegida

---

### 4.7 ShareSection (compartir campaña)

**Propósito:** Convertir a cada visitante en difusor. La viralidad es el principal mecanismo de crecimiento de las firmas.

**Relevancia:** Alto

**Contenido funcional:**
- Botón primario: WhatsApp (canal más efectivo en Ecuador)
- Botones secundarios: Facebook, X (Twitter), Email
- URL copiable con botón de copia al portapapeles (feedback visual al copiar)
- Código QR (opcional, configurable por campaña) — para difusión impresa o presencial
- Texto de difusión configurable por la organización (pre-cargado en los enlaces de compartir)
- Archivos descargables adjuntos (documentos técnicos, informes, etc.)
- Cuando la campaña está cerrada: mensaje alternativo "comparte el resultado"

---

### 4.8 RegionBars (distribución geográfica)

**Propósito:** Mostrar que el apoyo es territorial y diverso. Aporta legitimidad ante autoridades que valoran la representación provincial.

**Relevancia:** Medio

**Contenido funcional:**
- Barras horizontales por provincia con porcentaje de firmas
- Solo aparece si la campaña tiene datos regionales configurados

---

### 4.9 OrgCard (tarjeta de organización)

**Propósito:** Identificar quién está detrás de la campaña. Aporta credibilidad institucional.

**Relevancia:** Medio

**Contenido funcional:**
- Logo o inicial de la organización
- Nombre de la organización
- Acceso futuro a perfil completo (no implementado aún)

---

### 4.10 Banner de borrador

**Propósito:** Advertir claramente cuando la campaña está en modo de prueba (draft). Evita confusión entre firmas reales y de prueba.

**Relevancia:** Crítico (cuando aplica)

**Contenido funcional:**
- Texto: "Campaña en revisión · las firmas realizadas aquí son de prueba y no se contabilizarán"
- Ocupa el ancho completo de la pantalla, en posición destacada (top)
- Solo visible cuando `is_draft = true`

---

## 5. Catálogo de componentes — SignFlow (flujo de firma)

El SignFlow es un panel superpuesto (modal en desktop, sheet desde abajo en mobile) que maneja los frames 2 al 5.

### 5.1 Contenedor del panel

**Propósito:** Aislar el flujo de firma del resto de la landing. Mantiene el contexto visible al fondo.

**Relevancia:** Crítico

**Comportamiento:**
- Backdrop semitransparente con desenfoque sobre la landing
- Cierre con clic fuera del panel, tecla Escape, o botón X
- En mobile: aparece deslizándose desde la parte inferior (sheet)
- En desktop: centrado como diálogo modal
- Accesibilidad: focus trap interno, `role="dialog"`, `aria-modal`

### 5.2 Header del panel

**Propósito:** Orientación: en qué paso está el usuario y qué campaña está firmando.

**Relevancia:** Alto

**Contenido funcional:**
- Título dinámico según el step actual ("Firmar esta petición" / "Tu apoyo quedó registrado")
- Nombre de la campaña + cantidad de datos obligatorios (solo en step de formulario)
- Botón de cierre
- Handle de arrastre visual en mobile (indicador de que el sheet puede deslizarse)

### 5.3 StepForm (formulario de firma)

*Detallado en Frame 2 de la sección 3.*

**Relevancia:** Crítico

**Componentes internos:**
- TogglePills: selector de opciones excluyentes en forma de píldoras (tipo de firmante, ubicación, visibilidad)
- Inputs de texto, email, número
- Select de provincia (lista completa de las 24 provincias del Ecuador + "Otra")
- Checkbox de consentimiento con enlace al aviso de privacidad
- TurnstileWidget (anti-bot invisible de Cloudflare)
- Botón de submit (deshabilitado hasta que consentimiento y Turnstile estén completos)
- Aviso de verificación anti-bot y doble confirmación

### 5.4 StepSending (enviando)

**Propósito:** Feedback de carga durante el envío al backend.

**Relevancia:** Alto

**Contenido:** Indicador de progreso / animación de espera. Sin acciones.

### 5.5 StepSuccess (confirmación pendiente)

**Propósito:** Explicar el paso intermedio del doble opt-in. El usuario debe confirmar por email antes de que la firma sea válida.

**Relevancia:** Crítico

**Contenido funcional:**
- Ícono de email
- Título + explicación de que se envió un enlace al correo ingresado
- Muestra el correo al que se envió (para verificar si escribió bien)
- Botón primario: "Ya confirmé — continuar"
- Botón secundario: "Reenviar correo de confirmación" (con estados: idle / enviando / enviado)
- Nota sobre spam y tiempos de espera

### 5.6 StepError (error)

**Propósito:** Comunicar el fallo de forma clara y dar salida sin frustrar al usuario.

**Relevancia:** Alto

**Contenido funcional:**
- Mensaje de error específico según el tipo de falla
- Acción primaria: reintentar (mantiene los datos ya ingresados)
- Acción secundaria: volver a editar el formulario

### 5.7 StepThanks (gracias / difusión post-firma)

*Detallado en Frame 5 de la sección 3.*

**Relevancia:** Crítico

**Contenido funcional:**
- Ícono de confirmación
- Saludo personalizado con el nombre del firmante
- Número total de firmas actualizado (con el aporte reciente incluido)
- Progreso hacia el objetivo (si tiene)
- Texto motivacional ("¡Acabas de mover el contador!")
- Botones de compartir: WhatsApp (primario), Facebook, X, Email
- Texto de compartir predefinido que incluye el título de la campaña y la URL
- Checkbox opt-in newsletter con aclaración de consentimiento separado

---

## 6. Componentes de sistema (transversales)

Estos componentes son reutilizables y aparecen en múltiples pantallas, tanto públicas como de admin.

| Componente | Propósito | Relevancia |
|------------|-----------|------------|
| Button | Botón de acción con variantes (primario, secundario, destructivo, ghost) | Crítico |
| Badge | Etiqueta de estado o categoría (activa, cerrada, borrador, etc.) | Alto |
| Alert | Mensaje de alerta contextual: error, advertencia, éxito, info | Alto |
| Card | Contenedor con borde y fondo diferenciado para agrupar contenido relacionado | Alto |
| FormField | Label + input + mensaje de ayuda o error, como unidad visual | Crítico |
| MarkdownText | Renderiza texto con formato Markdown básico | Medio |

---

## 7. Componentes de admin (zona protegida)

La zona admin no se rediseña en esta fase; se lista para completar el mapa funcional.

| Componente / Página | Propósito | Relevancia en admin |
|---------------------|-----------|---------------------|
| AdminSidebar | Navegación principal del panel admin | Crítico |
| Resumen (KPIs) | Firmas confirmadas, campañas activas, organizaciones registradas | Alto |
| Campañas — listado | Tabla de campañas con estado, acciones | Alto |
| CampanaEditorClient | Formulario completo de creación y edición de campaña | Crítico |
| Firmas por campaña | Tabla paginada con filtros de fecha, región, visibilidad. Export CSV | Alto |
| Vista global firmas | Tabla de todas las campañas con conteo y acceso directo | Alto |
| Organizaciones | CRUD: nombre, descripción, logo, contacto | Alto |
| Categorías | CRUD: etiquetas temáticas para clasificar campañas | Medio |
| Políticas de privacidad | CRUD: textos de aviso de privacidad + contratos LOPDP | Alto |
| ExportCsvButton | Descarga CSV de firmas filtradas | Medio |
| FiltrosBar | Barra de filtros (fecha, región, visibilidad) para la tabla de firmas | Medio |
| LogoutButton | Cierre de sesión | Crítico |

---

## 8. Restricciones funcionales para el nuevo diseño

Estas restricciones no son de estilo sino de funcionamiento. Cualquier nuevo diseño debe respetarlas:

1. **El formulario de firma no navega a otra página.** El flujo completo (frames 2-5) ocurre superpuesto sobre la landing.
2. **El CTA de firma debe ser visible en todo momento en mobile.** Cuando el ActionBlock sale del viewport, un CTA flotante debe mantener la acción principal accesible.
3. **La barra de progreso es funcional.** No es decorativa; representa el porcentaje real de firmas sobre el objetivo.
4. **El widget Turnstile es no-interactivo.** No puede reemplazarse por un captcha de clic o checkbox visible; el diseño no debe reservar espacio prominente para él, ya que es invisible para el usuario cuando funciona correctamente.
5. **El opt-in de newsletter es un checkbox separado del consentimiento de firma.** Nunca pueden fusionarse en un solo checkbox.
6. **Las visibilidades (pública / anónima / secreta) deben presentarse como opciones claras y excluyentes.** No como texto pequeño ni ocultas detrás de un desplegable.
7. **El enlace al aviso de privacidad es obligatorio** y debe estar visible dentro del formulario, adyacente al checkbox de consentimiento.
8. **La campaña en borrador debe marcarse inequívocamente** para que nadie confunda las firmas de prueba con firmas reales.
9. **El estado "cerrada" debe comunicarse tanto en el ActionBlock como en el ShareSection.** Los botones de firma se deshabilitan; los de compartir pueden permanecer activos con mensaje adaptado.
10. **Los campos del formulario son configurables por campaña.** El diseño debe soportar formularios con más o menos campos sin romperse visualmente.

---

## 9. Sistema de diseño de referencia (zona pública)

> Extraído y curado a partir de seis sitios de referencia (Get Hyped, Museum of Money, Alethia, Clico, CauseHouse, IPER). Ver documento completo: `Sistema de Diseño - Análisis.dc.html`. Aplica únicamente a la landing del firmante; el admin se define en una fase posterior.

### 9.1 Paleta

| Color | Uso |
|-------|-----|
| `#FBF0E6` | Fondo crema (base de toda la landing) |
| `#DCE9E6` | Verde-azulado — fondo de secciones alternas |
| `#16261F` | Tinta verde — texto principal, bordes, superficies oscuras |
| `#12222E` | Tinta azul — variante de superficie oscura (degradado con la tinta verde) |
| `#D7F24C` | Lima — **reservado exclusivamente** para el botón de firmar (ActionBlock, CTA flotante, submit del formulario). No se reutiliza en ningún otro elemento. |
| `#2B4EEA` | Categoría · Agua |
| `#3F8F5C` | Categoría · Bosques |
| `#FF5A2B` | Categoría · Minería |
| `#F2C230` | Badge de progreso / paso |

Regla no-negociable: el botón de firmar usa un color que no aparece en ningún otro lugar del sistema, para que destaque en cualquier fondo (crema, tinta oscura, blanco de formulario).

Los fondos de tinta (verde y azul) llevan un degradado sutil (mismo tono, más claro a más oscuro), nunca un color plano.

### 9.2 Tipografía

- **Display — Anton**: titulares (H1/H2), condensado y de alto impacto. Tamaños grandes (32–84px).
- **Texto — Work Sans**: cuerpo, formularios, etiquetas. Mínimo 18–19px para contenido que decide (nunca texto pequeño en el cuerpo de la petición o el formulario).

### 9.3 Componentes recurrentes

- **Badge / pill**: cápsula redondeada, borde o relleno de tinta — categoría de campaña, chip "Dirigida a".
- **Botón con ícono / pill de acción**: relleno de tinta oscura + texto blanco (acciones secundarias como compartir); relleno lima exclusivo para firmar.
- **Tarjeta de borde fino**: fondo blanco, borde 1.5px tinta verde, esquinas redondeadas 14–18px — usada en asks, adjuntos, firmas recientes, ActionBlock, OrgCard.
- **Stepper + barra de progreso**: puntos conectados por línea, etapa activa resaltada — usado en LifecycleSteps y en el progreso del ActionBlock.
- **Ritmo de sección**: bloques de fondo sólido/degradado alternan con crema para marcar etapas del relato; máximo un acento de color por pantalla.

### 9.4 Notas de implementación

- Mobile y desktop se resuelven en un único prototipo responsivo (no dos archivos separados): el layout pasa de dos columnas (contenido + panel de acción fijo) a una columna con el panel de acción primero.
- El SignFlow se presenta como diálogo centrado en desktop y como hoja deslizada desde abajo en mobile, sobre el mismo componente.
- Prototipo de referencia: `Landing de Campaña.dc.html`.
