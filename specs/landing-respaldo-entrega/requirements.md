# Requirements — landing-respaldo-entrega

## Contexto

Cuando una campaña llega a la etapa de entrega, la organización necesita
adjuntar al documento físico/PDF de entrega (firmas + petición) un respaldo
que le permita a la autoridad receptora **verificar por sí misma** cómo se
recolectaron las adhesiones: cuántas son, de dónde, bajo qué garantías
técnicas y bajo qué marco de privacidad. Hoy no existe una página así — el
landing público (`landing-campana`) está pensado para conseguir firmas
nuevas, no para servir de evidencia documental una vez cerrada la
recolección.

Esta feature agrega una página informativa, de solo lectura, en una URL
propia con QR descargable, pensada para imprimirse/adjuntarse junto al
documento de entrega.

**Decisiones tomadas con el usuario:**
- URL: subruta de la campaña ya existente, `/c/{slug}/respaldo` (reutiliza
  la resolución de campaña por slug/Host que ya tiene el proyecto — sin
  infraestructura de enlace corto nueva).
- Las secciones de seguridad, fiabilidad de firmas y resumen de privacidad
  son **texto fijo de plataforma**, igual para todas las campañas — solo
  cambian los números (conteos, fechas). No es editable por campaña.
- Debe seguir siendo accesible **aunque la campaña se cierre o archive** —
  es justamente el soporte que se entrega después de terminar la
  recolección.

## Requisitos

### Acceso y disponibilidad
- **R1** El sistema DEBERÁ servir esta página en `/c/{slug}/respaldo`,
  resuelta igual que el resto de rutas de campaña (por slug o por Host en
  dominio propio).
- **R2** A diferencia del resto de endpoints públicos de campaña, este
  DEBERÁ seguir respondiendo 200 aunque `campaign.archived_at` no sea nulo
  o `status` sea `closed`/`archived` — el único caso que DEBERÁ dar 404 es
  que el slug no exista.
- **R3** La página NO DEBERÁ requerir autenticación — es pública por diseño
  (va a manos de una autoridad externa que no tiene cuenta en la
  plataforma).
- **R4** La página DEBERÁ incluir `<meta name="robots" content="noindex">`
  — es contenido evidenciario dirigido a un destinatario específico, no
  contenido a indexar en buscadores.

### Detalles de la campaña
- **R5** DEBERÁ mostrar: título público de la petición, organización
  responsable (nombre + logo si existe), autoridad/entidad destinataria
  (`campaign.authority`), categoría/tema, y un resumen del pedido (`asks`).
- **R6** SI la campaña tiene `processing_contract_id`, ENTONCES DEBERÁ
  indicarse que la plataforma opera como Encargado del tratamiento bajo un
  contrato de encargo vigente (sin exponer el contrato mismo, solo la
  mención).

### Cuantificación de firmas
- **R7** DEBERÁ mostrar el total de firmas **confirmadas** (mismo criterio
  que el conteo público existente — excluye `pending_confirmation` y
  anuladas).
- **R8** DEBERÁ desglosar el total por **tipo de visibilidad**
  (pública / anónima / secreta) con su conteo — sin listar ni un solo
  nombre; el desglose es agregado únicamente.
- **R9** DEBERÁ desglosar el total por **origen**: provincia para firmas
  nacionales, país para internacionales — mismo criterio de agrupación
  "Internacional" ya usado en el dashboard admin de firmas.
- **R10** El desglose NO DEBERÁ excluir ninguna visibilidad ni origen —
  a diferencia del feed público de firmas recientes, acá el objetivo es el
  conteo total real, no la vitrina de nombres.

### Fechas
- **R11** DEBERÁ mostrar: fecha de lanzamiento (primer `lifecycle_event`
  con `stage_index=0`, o `campaign.created_at` si no hay evento), fecha de
  cierre de recolección (`campaign.ends_at` o el evento de etapa "Entrega"
  si ya ocurrió, lo que exista), y **fecha/hora de generación de esta
  página** ("Datos actualizados al: …") — porque los conteos pueden seguir
  cambiando hasta que la campaña esté realmente cerrada.

### Seguridad del sistema (texto fijo)
- **R12** DEBERÁ describir, en lenguaje llano y **solo lo que está
  implementado hoy**: verificación humana anti-bot (Cloudflare Turnstile),
  límite de tasa de envíos por IP, cifrado en reposo de datos personales
  (AES-256-GCM), aislamiento de datos por organización (Row-Level Security
  en PostgreSQL), comunicación cifrada (HTTPS/TLS), registro de auditoría
  sin datos personales en texto plano (HMAC-SHA256 de IP/email en logs).

### Fiabilidad de las firmas (texto fijo)
- **R13** DEBERÁ describir, igual de honesto y acotado a lo ya
  implementado: confirmación por correo electrónico (doble opt-in — una
  firma no cuenta como confirmada hasta que la persona hace clic en el
  enlace de su email), validación del dígito verificador de cédula
  ecuatoriana (módulo 10) para personas naturales, deduplicación por email
  normalizado dentro de la misma campaña.
- **R14** NO DEBERÁ mencionar controles que todavía no existen en
  producción (p. ej. deduplicación robusta multi-señal, hoja híbrida de
  papel) — el texto se ajusta cuando esas features se implementen.

### Resumen de política de privacidad
- **R15** DEBERÁ mostrar un resumen breve (rol de Encargado del
  tratamiento, qué implica cada visibilidad, base legal) con un link a la
  política de privacidad completa vigente de la campaña
  (`privacy_policy_id` → `aviso_firmante`), si existe.

### QR
- **R16** DEBERÁ ofrecer un botón "Descargar QR" que genere, en el
  navegador (misma librería `qrcode` ya usada en el editor admin), un PNG
  del QR que codifica la URL completa de esta página — sin persistir nada
  nuevo en base de datos (la URL es determinística a partir del slug).

### Privacidad de los datos mostrados
- **R17** La página NO DEBERÁ exponer, bajo ninguna circunstancia, nombre,
  cédula, email o cualquier dato individual de un firmante — únicamente
  conteos agregados. Esto aplica incluso a firmas `publica`: acá se cuentan,
  no se listan (el listado con nombres es el documento de entrega
  separado, no esta página).

### Tests
- **R18** Los tests DEBERÁN cubrir: 200 con campaña archivada, 404 con
  slug inexistente, agregación correcta por tipo y por origen (incluyendo
  agrupación "Internacional"), ausencia de cualquier PII individual en la
  respuesta/HTML, y presencia del meta `noindex`.

## Fuera de alcance

- Mapa interactivo de distribución geográfica (feature separada
  `mapa-geografico`, Fase 4, pending) — acá el desglose de origen es una
  lista/tabla, no un mapa.
- Enlace corto dedicado (feature separada `enlace-corto-qr`, spec_ready)
  — esta página usa la URL larga de campaña.
- Documento PDF con hash de integridad (feature separada
  `documento-entrega`, Fase 4, pending) — esta landing es un complemento
  web, no reemplaza ese PDF.
- Edición del texto fijo por campaña (decisión tomada con el usuario:
  texto de plataforma, no editable).
