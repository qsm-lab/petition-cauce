# Requirements — centro-comunicaciones

## Contexto

Evolución de la comunicación con adherentes desde el popup actual
(`AdherentCommsModal`, 3 pestañas: invitación al evento / aviso de cierre /
mensaje libre) hacia un **frame dedicado** en el admin, con las funciones
esenciales de una plataforma de mailing: editor de contenido enriquecido
(estilo entradas de WordPress) con carga de imágenes, **segmentación** de
destinatarios por parámetros de la campaña, **programación** de envíos y
**cola** que respeta la cuota del proveedor.

El centro está **atado a una campaña y su organización**: el remitente, el
scope de destinatarios y el registro de auditoría se resuelven por campaña.

**Consolidación** — esta feature absorbe y supersede:
- `comunicaciones-cierre-campana` (in_progress): los 3 tipos de envío pasan al
  frame; el "mensaje adicional/libre" se convierte en el **contenido general**.
- `programacion-historial-comunicaciones` (spec_ready): programación + historial
  se implementan aquí (mismo loop in-process ya diseñado).
- Toma como **precondición** el footer de cumplimiento LOPDP y la desuscripción
  de `email-cumplimiento-masivo` (pending) para la clase "anuncios" (ver R11,
  §Dependencias).

**Proveedor**: Resend. Free = 3.000/mes, **100/día**, 1 dominio; Pro ($20) =
50.000/mes, sin límite diario, 10 dominios. Batch y tracking en ambos. El plan
varía por campaña (p. ej. Camp-01_AMICUS_TLC_USA tiene Pro). **Las funciones
básicas asumen free por defecto**; las funciones ampliadas se habilitan si la
campaña tiene Pro.

## Decisiones tomadas (ronda de aclaración, sesión 37)

- **D1 — Dos clases de envío** (base LOPDP): (a) *anuncios* → filtran siempre
  `notify_updates=true`; (b) *servicio/transaccional* (recordatorio de
  confirmación, invitación al evento, aviso de cierre) → van a firmantes sobre
  su propio trámite sin exigir `notify_updates`. La clase determina la base
  legal y el universo permitido.
- **D2 — Imágenes** en volumen del VPS, **25 MB**/archivo, jpg/png/webp/gif,
  servidas como URL pública bajo el dominio.
- **D3 — Remitente/proveedor por organización** (refinado sesión 37 → spec
  `config-email-org`): el proveedor, credenciales, plan y dominios son de la
  **org** (multi-proveedor: Resend / SMTP / adaptadores API nativos); la campaña
  solo ajusta `from`/`reply-to`/`display-name` cosméticos dentro de los dominios
  permitidos de su org.
- **D4 — Cola multi-día automática**: el scheduler envía hasta la cuota diaria
  del plan y continúa el resto los días siguientes, con progreso visible.

## Requisitos

### Frame dedicado
- **R1** El sistema DEBERÁ ofrecer una página admin dedicada (p. ej.
  `/admin/campanas/{id}/comunicaciones`) que reemplace el popup
  `AdherentCommsModal`; el popup se retira.
- **R2** El frame DEBERÁ operar con scope de la campaña y su organización
  (JWT + rol `admin`/`gestor` + scope de campaña, patrón existente), y resolver
  el remitente por campaña (R16).

### Editor de contenido (estilo WordPress)
- **R3** El editor DEBERÁ ofrecer texto enriquecido: párrafo/encabezados,
  negrita, cursiva, listas (viñeta/numerada), cita, alineación, enlaces, y
  vistas **Visual** y **Código/HTML** (referencia: editor clásico de WordPress).
- **R4** El editor DEBERÁ permitir **cargar imágenes** e insertarlas en el
  cuerpo: máx. **25 MB**/archivo, formatos jpg/png/webp/gif (D2); la imagen se
  almacena y se referencia por **URL pública** en el HTML del email (nunca como
  adjunto pesado).
- **R5** El "mensaje" DEBERÁ ser el **contenido general/principal** del envío
  (no un extra opcional). Los tipos "invitación"/"cierre" siguen aportando sus
  campos estructurados (fecha, lugar, conteo) alrededor de ese contenido.
- **R5b** El envío DEBERÁ permitir configurar **al menos un botón CTA editable**
  (texto + URL), con vista previa, activable/desactivable, y con posibilidad de
  agregar más de uno. El botón se renderiza con el estilo de la plantilla (pill,
  color de acento de la campaña). URLs validadas/normalizadas (mismo criterio de
  `_social_href`: anteponer `https://` si falta esquema).
- **R5c** El envío DEBERÁ permitir **incluir o no el bloque de redes sociales**
  de la campaña/organización (las cargadas en el admin, reutilizando
  `_social_icon_links`), como un toggle; solo se muestran las redes con URL
  cargada.
- **R6** El HTML producido por el editor DEBERÁ ser **sanitizado en el backend**
  contra una allowlist (etiquetas/atributos seguros) antes de enviarse o
  guardarse — nunca se envía HTML del editor sin sanitizar (anti-XSS/inyección),
  y DEBERÁ envolverse en la plantilla email-safe de la plataforma.
- **R7** El frame DEBERÁ conservar **vista previa real** (mismo HTML que se
  envía) y **envío de prueba** a direcciones libres antes del envío masivo
  (heredado del popup).

### Segmentación de destinatarios
- **R8** El admin DEBERÁ poder segmentar los destinatarios por parámetros de la
  campaña: **tipo de firmante** (natural / organización), **ubicación** (Ecuador
  / internacional), **visibilidad** (pública / anónima / secreta) y **estado de
  adhesión** (confirmadas / no confirmadas / ambas).
- **R9** Cada envío DEBERÁ declarar su **clase** (anuncios / servicio, D1); la
  clase acota el universo antes de aplicar la segmentación (R11).
- **R10** El sistema DEBERÁ mostrar el **conteo de destinatarios en vivo** para
  el segmento seleccionado, recalculado al cambiar los filtros o la clase.
- **R11** El sistema DEBERÁ imponer los límites LOPDP por clase:
  - *anuncios* → solo `notify_updates=true` AND `status=confirmed` AND
    `archived_at IS NULL`; la segmentación es un subconjunto de ese universo.
  - *servicio* → firmantes de la propia campaña; a firmas `pending_confirmation`
    solo se permite el recordatorio de confirmación (no "contenido general").
  - Las firmas **secretas** y **anonimizadas/archivadas** nunca se exponen con
    PII; el envío usa el email cifrado descifrado en memoria, sin listarlas.

### Programación, cola e historial (absorbe programacion-historial-comunicaciones)
- **R12** El admin DEBERÁ poder **programar** cualquier envío para una fecha/hora
  futura; el envío programado persiste todos los campos para reconstruir el
  email al dispararse (contenido sanitizado incluido).
- **R13** Un loop asíncrono in-process (lifespan de FastAPI, sin Celery/
  APScheduler) DEBERÁ disparar los envíos vencidos y **repartir el envío masivo
  respetando la cuota diaria del plan** (100/día en free): envía hasta el tope y
  continúa al día siguiente, hasta completar el segmento (D4). El claim de cada
  lote DEBERÁ ser atómico (no duplicar si corre en más de un worker).
- **R14** El sistema DEBERÁ registrar cada envío **real** (inmediato o
  programado): tipo, clase, asunto, conteo de destinatarios, quién lo disparó (o
  "programado"), fecha/hora, y progreso (enviados/pendientes/fallidos). Los
  envíos de **prueba** se registran con `mode=test`, distinguibles. El historial
  **no** guarda el HTML/contenido, solo metadatos (auditoría).
- **R15** El admin DEBERÁ poder **cancelar** un envío programado o una cola en
  curso mientras queden lotes `pending`. Un envío no se edita in-place: se
  cancela y se crea uno nuevo. Un lote fallido queda `failed` con el error, sin
  reintento automático.

### Remitente y proveedor (delegado a `config-email-org`)
- **R16** El proveedor de email, las credenciales, el plan y los dominios son de
  la **organización** y se resuelven vía `config-email-org` — el centro NO define
  proveedor ni credenciales propias. La campaña solo aporta `from`/`reply-to`/
  `display-name` **cosméticos**, dentro de los dominios permitidos de su org.
- **R17** La **cuota diaria** de la cola (R13) DEBERÁ derivarse de las
  `capabilities()` del transporte resuelto por `config-email-org` (no hardcodear
  100/día) y contarse **por credencial de proveedor** de la org, no por campaña.

### Seguridad / multi-tenant
- **R18** Todas las tablas nuevas (envíos programados, historial, uploads)
  DEBERÁN llevar **RLS** con el patrón `org_id` + políticas org/`is_platform_admin`
  (una org nunca ve ni cancela envíos/uploads de otra).
- **R19** El endpoint de carga de imágenes DEBERÁ validar tipo MIME real y
  tamaño (25 MB), rechazar ejecutables/SVG con script, y almacenar con nombre
  no adivinable; rate limiting por IP (HMAC).
- **R20** Los envíos de la clase *anuncios* DEBERÁN incluir el footer de
  cumplimiento con **desuscripción** funcional (derecho de oposición LOPDP) —
  precondición de `email-cumplimiento-masivo`.

### Visibilidad de cuota
- **R21** El admin del centro DEBERÁ mostrar el **consumo de cuota** del
  proveedor de la org en tiempo (casi) real: para Resend, el último valor de
  `x-resend-daily-quota`/`x-resend-monthly-quota` capturado por `config-email-org`
  con su timestamp ("actualizado al último envío"), junto al conteo del segmento,
  para que el admin sepa si el envío cabe en la cuota del día. (Resend no expone
  endpoint de solo-lectura de uso; el dato se obtiene de los headers de las
  respuestas de envío.)

### Borrador, navegación y layout
- **R22** El gestor DEBERÁ poder **guardar como borrador** un envío sin
  enviarlo, para retomarlo después. El borrador persiste **server-side** (no se
  pierde al cambiar de frame, cerrar sesión o cambiar de dispositivo) e incluye
  todo el contenido en curso (tipo, clase, asunto, cuerpo, CTA, redes, segmento).
  Además, el frame DEBERÁ **autoguardar localmente** el progreso como red de
  seguridad. Los borradores se listan (panel de envíos) y se pueden retomar o
  eliminar.
- **R23** El frame DEBERÁ ofrecer una acción para **volver al admin de la
  campaña** sin perder el progreso (el borrador/autosave lo preserva, R22).
- **R24** El centro **depende** de la feature de shell
  **`admin-sidebar-colapsable`** (sidebar contraíble/expandible), que amplía el
  área de trabajo. Es una feature independiente, especificada aparte
  (`specs/admin-sidebar-colapsable/`); el centro es su principal beneficiario
  pero **no la implementa**.

## Fuera de alcance

- Broadcasts/Audiences de Resend (producto aparte, no incluido en free/pro base).
- Editor de plantillas reutilizables entre campañas / biblioteca de plantillas.
- A/B testing, automatizaciones/drip, analítica de aperturas por firmante
  (más allá de lo que Resend expone).
- Verificación automática de dominios de org en Resend (R16 asume el dominio ya
  verificado por fuera para el caso Pro).
- Editar un envío programado in-place (R15: cancelar + recrear).

## Tests (resumen; detalle en tasks.md)
- Segmentación produce exactamente el universo esperado por clase (R8–R11),
  incluida la exclusión de secretas/archivadas y el bloqueo de "anuncios" a
  no consentidos.
- Cola respeta la cuota diaria y reparte multi-día; claim atómico (R13).
- Sanitización elimina HTML peligroso y preserva el permitido (R6).
- Historial no persiste contenido (R14).
- Upload rechaza tipo/tamaño inválido (R19).
