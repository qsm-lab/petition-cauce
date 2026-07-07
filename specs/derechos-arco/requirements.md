# Requirements — derechos-arco

## Contexto

Canal self-service para que un firmante ejerza sus derechos LOPDP: acceso,
rectificación, eliminación/supresión, oposición y portabilidad. La plataforma
(Encargado) facilita el ejercicio; la organización (Responsable) es la obligada
formal. Cierra el ciclo de revocación iniciado en formulario-firma.

## Requisitos

### Verificación de identidad
- **R1** CUANDO un titular solicite ejercer un derecho, el sistema DEBERÁ verificar identidad con doble factor: (a) enlace de verificación enviado al email registrado y (b) coincidencia de cédula contra `cedula_hash` de la firma.
- **R2** El sistema NUNCA DEBERÁ revelar si un email/cédula tiene firmas registradas: la respuesta pública siempre es "si existen datos asociados, enviaremos un enlace al correo" (anti-enumeración).
- **R3** El enlace de verificación DEBERÁ expirar en 1 hora, ser de un solo uso, y abrir una sesión de portal de datos de corta duración (30 min).
- **R4** El formulario de solicitud DEBERÁ estar protegido por Turnstile + rate limiting por IP (HMAC).

### Derechos
- **R5 (Acceso)** El portal DEBERÁ mostrar al titular todos sus datos asociados a la campaña: nombre, email, cédula (parcialmente enmascarada), provincia/país, visibilidad, estado, fecha de firma, y el consentimiento otorgado (texto, versión, fecha).
- **R6 (Rectificación)** El portal DEBERÁ permitir corregir: `name`, `provincia`/`country` y `visibility`. Email y cédula NO son rectificables self-service (identifican la firma; su corrección implica suprimir y re-firmar).
- **R7 (Supresión)** CUANDO el titular confirme la supresión, el sistema DEBERÁ anonimizar la firma de inmediato (mismo mecanismo que retencion-datos) y confirmar en pantalla + email.
- **R8 (Oposición)** El portal DEBERÁ permitir revocar `notify_updates` y `subscribe_newsletter` sin suprimir la firma.
- **R9 (Portabilidad)** El portal DEBERÁ ofrecer descarga de los datos del titular en JSON estructurado (y CSV), generado on-demand, sin almacenar el archivo.

### Trazabilidad y Encargado
- **R10** Toda solicitud ARCO DEBERÁ registrarse en una tabla de auditoría: tipo de derecho, timestamp, `email_hash` (nunca email en claro), campaña, resultado. Evidencia de cumplimiento de plazos LOPDP (15 días).
- **R11** CUANDO se complete una supresión o rectificación, el sistema DEBERÁ notificar por email al `contact_email` de la organización Responsable (fire-and-forget, sin PII del titular en el correo — solo tipo de acción, campaña y fecha).
- **R12** SI la firma ya fue anonimizada por retención, ENTONCES el portal DEBERÁ informar que no existen datos asociados (respuesta genérica R2).

### Tests
- **R13** Los tests DEBERÁN cubrir: anti-enumeración, expiración y unicidad del token, verificación cédula+email, cada derecho (R5-R9), auditoría sin PII y rate limiting.

## Fuera de alcance

- Gestión de solicitudes ARCO manuales/por email (canal humano del Responsable).
- Derechos sobre datos fuera de `signatures`/`consents` (no hay otros datos de titulares).
- Panel admin de solicitudes ARCO (fase posterior si el volumen lo amerita).
