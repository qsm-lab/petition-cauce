# Requirements — export-entrega

## Contexto

Al llegar la campaña a la etapa **Entrega**, la organización Responsable necesita
el lote completo de firmas con cédula y email **en claro** para conformar el
documento de entrega oficial ante la autoridad. El export estándar del dashboard
solo lleva PII enmascarada (`cedula_parcial`, `email_parcial` — sesión 27), por
diseño.

Decisión de producto (análisis aprobado en sesión 27): la descarga completa
requiere **autorización reforzada** (step-up auth): re-validación de contraseña
+ código OTP al email del admin, token de descarga de un solo uso, auditoría
sin PII y notificación al Responsable. Las firmas **secretas** nunca integran
el archivo de entrega — solo suman al conteo (compromiso comunicado al firmante
en el formulario y en el email de confirmación).

## Requisitos

### Disponibilidad
- **R1** El dashboard de firmas DEBERÁ mostrar el botón "Descarga de entrega" únicamente CUANDO la campaña esté en etapa Entrega o posterior (`lifecycle_stage >= 2`) y el usuario tenga rol `admin` o `gestor` con acceso a la campaña. En etapas anteriores el botón no se renderiza y el API rechaza la solicitud con 409.

### Step-up auth
- **R2** CUANDO el admin solicite la descarga, el sistema DEBERÁ exigir la re-validación de su contraseña de login y, si es correcta, generar un código OTP de 6 dígitos con TTL de 10 minutos, almacenado **hasheado** en Redis (`petition:otp:export:<user_id>:<campaign_id>`), y enviarlo al email del admin autenticado.
- **R3** El sistema DEBERÁ limitar la generación a 3 solicitudes de OTP por hora por usuario y la verificación a 3 intentos por código; al agotar los intentos el código DEBERÁ invalidarse.
- **R4** CUANDO el OTP se verifique correctamente, el sistema DEBERÁ emitir un token de descarga de un solo uso con TTL de 5 minutos, ligado al usuario y a la campaña; el token DEBERÁ invalidarse al primer uso.

### Contenido del export
- **R5** La descarga DEBERÁ producir un CSV con PII descifrada (nombre, cédula completa, email completo, provincia/país, visibilidad, fechas) que incluya SOLO firmas `status = 'confirmed'`, excluyendo archivadas y anonimizadas.
- **R6** Las firmas con `visibility = 'secreta'` NUNCA DEBERÁN aparecer en el archivo de entrega; el CSV DEBERÁ incluir en cabecera (fila de metadatos o columna) el conteo de secretas excluidas para que el total declarado cuadre con el contador público.
- **R7** Cada archivo DEBERÁ llevar una columna `export_id` (UUID de la operación) como marca de trazabilidad.

### Auditoría y transparencia
- **R8** Cada descarga DEBERÁ registrarse en la tabla `pii_export_audit` (export_id, campaign_id, user_id, ip_hmac, row_count, created_at) — sin PII.
- **R9** Al completarse la descarga, el sistema DEBERÁ notificar por email al contacto de la organización Responsable (`organizations.contact_email`) y a `platform_admin_emails`: export_id, campaña, admin que descargó, fecha y número de filas, con recordatorio del deber de custodia y plazo de retención del Responsable.

### Seguridad
- **R10** Los endpoints DEBERÁN exigir JWT + rol (`admin`/`gestor`) + validación campaña→org (patrón del router admin); las respuestas de error de contraseña/OTP NO DEBERÁN distinguir entre usuario inexistente, contraseña errónea o código inválido (mensaje genérico).

### Tests
- **R11** Los tests DEBERÁN cubrir: visibilidad por etapa (R1), flujo completo password→OTP→token→CSV, expiración y unicidad del token (R4), exclusión de secretas/archivadas (R5, R6), límites de intentos y rate limit (R3), auditoría sin PII (R8), y permisos 401/403 (R10).

## Fuera de alcance

- Documento de entrega con hash de integridad y sello de tiempo — es `documento-entrega` (fase 4); este export es el insumo.
- Descarga cifrada (ZIP con clave) — evaluar como mejora si el Responsable lo pide.
- Export de consentimientos (snapshot LOPDP) — puede sumarse a `documento-entrega`.
