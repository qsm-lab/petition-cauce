# Requirements — derechos-arco

## Contexto

Canal self-service para que un firmante ejerza sus derechos LOPDP: acceso,
rectificación, eliminación/supresión, oposición y portabilidad. La plataforma
(Encargado) facilita el ejercicio; la organización (Responsable) es la obligada
formal. Cierra el ciclo de revocación iniciado en formulario-firma.

**Actualización sesión 30**: el alcance pasó de estar acotado a una campaña a
ser **multi-campaña/plataforma completa** — un mismo firmante puede haber
firmado varias campañas de Cauce con el mismo email+cédula; el portal
reúne todas sus firmas no anonimizadas en una sola sesión verificada.

## Requisitos

### Verificación de identidad
- **R1** CUANDO un titular solicite ejercer un derecho, el sistema DEBERÁ verificar identidad con doble factor: (a) enlace de verificación enviado al email registrado y (b) coincidencia de cédula contra `cedula_hash` de la firma.
- **R2** El sistema NUNCA DEBERÁ revelar si un email/cédula tiene firmas registradas: la respuesta pública siempre es "si existen datos asociados, enviaremos un enlace al correo" (anti-enumeración).
- **R3** El enlace de verificación DEBERÁ expirar en 1 hora, ser de un solo uso, y abrir una sesión de portal de datos de corta duración (30 min).
- **R4** El formulario de solicitud DEBERÁ estar protegido por Turnstile + rate limiting por IP (HMAC).
- **R1b (multi-campaña)** La verificación de identidad DEBERÁ ser platform-wide: la búsqueda por email+cédula NO se limita a una campaña — un solo enlace de verificación abre una sesión de portal que agrupa **todas** las firmas no anonimizadas de esa persona en cualquier campaña de la plataforma.

### Derechos
- **R5 (Acceso)** El portal DEBERÁ mostrar al titular sus datos personales compartidos (nombre, email/cédula/celular enmascarados) y, por cada campaña encontrada, sus datos específicos: tipo de firmante, ubicación (provincia/país), visibilidad, estado, fecha de firma, y el consentimiento otorgado (texto, versión, fecha).
- **R6a (Rectificación — datos personales, compartidos)** El portal DEBERÁ permitir corregir `name`, `email`, `cedula` y `celular` (opcional) **una sola vez**, aplicando el cambio a todas las firmas no anonimizadas del titular simultáneamente (son la misma persona). Se registra en la auditoría qué campos cambiaron (no los valores) para trazabilidad, sin exponer PII.
  - Email y cédula son únicos **por campaña** (índices `uq_sig_email_*`/`uq_sig_cedula_natural`, migración 006) — si el valor nuevo ya está en uso en alguna campaña puntual de la sesión, esa campaña queda sin cambiar y se reporta como conflicto; las demás campañas sí se actualizan (no es todo-o-nada).
  - **Congelamiento por cierre**: `name`/`email`/`cedula` ("datos esenciales para la firma") quedan atados de forma permanente a cualquier campaña que ya haya cerrado (`status` fuera de `draft`/`active`/`online`) — pudieron usarse en la entrega formal de firmas; el intento de cambiarlos en esa campaña se reporta como conflicto (`reason="campana_cerrada"`), sin bloquear el cambio en las demás campañas activas de la sesión.
  - Si al cambiar el email una firma está `pending_confirmation` (y la campaña no está cerrada), se regenera el `confirmation_token` y se reenvía el correo de confirmación a la dirección **nueva** automáticamente.
  - El aviso de seguridad de cambio (R18) se envía al correo **anterior**, no al nuevo — señal estándar ante cambio de credencial.
  - `celular` no participa en la verificación de identidad ni tiene índice, y nunca formó parte de lo entregado — siempre editable, incluso en campañas cerradas.
- **R6b (Rectificación — por campaña)** El portal DEBERÁ permitir, de forma independiente por cada campaña:
  - `visibility`, con una explicación de qué implica cada opción (pública/anónima/secreta) visible junto al selector — siempre editable.
  - `provincia`/`country` — geográfico, no es "esencial para la firma"; editable siempre, independiente del estado de confirmación o de la campaña.
  - `signer_type` (natural/organización) y modo de ubicación (Ecuador/internacional) — estructurales; editables **solo** mientras la firma sigue `pending_confirmation` Y la campaña acepta firmas. Una vez confirmada o cerrada la campaña, quedan fijos (mismo criterio que el alta original: se eligen una vez).
- **R7 (Supresión, por campaña)** CUANDO el titular confirme la supresión de una campaña específica, el sistema DEBERÁ anonimizar esa firma de inmediato (mismo mecanismo que retencion-datos) y confirmar en pantalla + email. La supresión de una campaña NO afecta a las demás firmas del titular.
- **R8 (Oposición, por campaña)** El portal DEBERÁ permitir revocar `notify_updates` y `subscribe_newsletter` de forma independiente por cada campaña.
- **R9 (Portabilidad, unificada)** El portal DEBERÁ ofrecer descarga de los datos del titular en **todas** sus campañas en un solo archivo JSON estructurado (y CSV), generado on-demand, sin almacenar el archivo.
- **R14 (Confirmación manual, nuevo)** El portal DEBERÁ ofrecer, por campaña, un botón para confirmar una firma `pending_confirmation` en el momento — habilitado solo si la campaña todavía acepta firmas (`draft`/`active`/`online`); deshabilitado/oculto si la firma ya está confirmada o la campaña ya cerró.

### Acceso desde el resto de la plataforma (nuevo)
- **R15 (Acceso directo post-confirmación)** El email de agradecimiento enviado tras confirmar una firma (doble opt-in) DEBERÁ incluir un enlace de acceso directo al portal (sin pasar por el formulario de email+cédula), usando un token equivalente al de R3 pero con TTL de 24h (puede abrirse días después). Auto-confirma la firma que originó el envío (ya lo estaba) y preselecciona esa campaña en el portal.
- **R16 (Botón en landing)** Toda landing pública de campaña DEBERÁ mostrar un botón secundario "¿Ya firmaste? Accedé a tus datos" junto al CTA principal de firma, que dirige al formulario de solicitud (`/mis-datos`) con la campaña de origen preservada como contexto.
- **R17 (Contexto de campaña de origen)** CUANDO el acceso al portal se origine desde una campaña específica (landing o email), el portal DEBERÁ preseleccionar esa campaña por defecto entre las encontradas, con un selector visible para cambiar a las demás y una indicación permanente de cuál campaña se está editando.
- **R1c (auto-confirmación al verificar)** CUANDO la única/alguna firma encontrada esté `pending_confirmation` y su campaña siga en estado firmable al momento de la verificación, el sistema DEBERÁ confirmarla automáticamente como parte de la verificación de identidad (el enlace ARCO ya prueba la titularidad del email). Si la campaña ya cerró, se omite la confirmación automática pero se conserva el acceso al portal para gestionar ese registro (ver R14 para confirmarla manualmente si la campaña reabre).
- **R19 (Revisión antes de confirmar, nuevo)** El email de confirmación original (doble opt-in, enviado al firmar) DEBERÁ mostrar un resumen de los datos ingresados con el mensaje "revisa que tus datos hayan quedado bien escritos", y un enlace secundario — visualmente menor al botón de confirmar — que entra directo al portal (mismo mecanismo de R15) para corregir antes de confirmar. Objetivo: evitar rectificaciones después, resolviendo errores desde el primer momento.
  - El resumen SIEMPRE incluye nombre completo y cédula (enmascarada) — nunca el correo: que el mensaje haya llegado a la bandeja ya prueba que se escribió bien.
  - Suma organización, ubicación (provincia o país, según el modo) y celular **solo si la campaña los pidió y el firmante los completó** ("datos adicionales estructurales y geográficos, de ser el caso").
- **R20 (Celular configurable por campaña, nuevo)** El admin DEBERÁ poder activar/desactivar, por campaña, si el formulario de firma solicita un celular opcional (`form_config.request_celular`, panel "Configuración formulario"). Nunca es obligatorio. El dato se guarda cifrado igual que email/cédula.

### Trazabilidad, Encargado y notificaciones
- **R10** Toda solicitud ARCO DEBERÁ registrarse en una tabla de auditoría: tipo de derecho, timestamp, `email_hash` (nunca email en claro), campaña, resultado. Evidencia de cumplimiento de plazos LOPDP (15 días). Una solicitud que no encuentra ninguna coincidencia (R2) no genera fila de auditoría (no hay `campaign_id` que asociar).
- **R11** CUANDO se complete una supresión o rectificación de datos personales, el sistema DEBERÁ notificar por email al `contact_email` de la organización Responsable de la campaña afectada (fire-and-forget, sin PII del titular en el correo — solo tipo de acción, campaña y fecha).
- **R12** SI la firma ya fue anonimizada por retención o supresión, ENTONCES el portal DEBERÁ informar que no existen datos asociados (respuesta genérica R2) — al haber cambiado `email_hash`/`cedula_hash` en la anonimización, deja de coincidir con la búsqueda de forma natural.
- **R18 (Notificación de cambio al titular, nuevo)** CUALQUIER cambio realizado desde el portal (datos personales, visibilidad, oposición, confirmación manual, supresión) DEBERÁ notificarse por email al propio titular (transparencia/seguridad — permite detectar uso no autorizado de la sesión), independiente de la notificación a la organización (R11).

### Tests
- **R13** Los tests DEBERÁN cubrir: anti-enumeración, expiración y unicidad del token (incluida la restricción `UNIQUE` de `arco_verification_token` — el token se ancla a una sola fila y la sesión de portal reconstruye el resto por email_hash+cédula_hash), verificación cédula+email platform-wide, cada derecho (R5-R9, R14), auto-confirmación condicionada al estado de campaña (R1c), rectificación de datos personales aplicada a múltiples campañas con trazabilidad sin PII (R6a), aislamiento entre campañas (una acción sobre una no afecta a otra), auditoría sin PII y rate limiting.

## Fuera de alcance

- Gestión de solicitudes ARCO manuales/por email (canal humano del Responsable).
- Derechos sobre datos fuera de `signatures`/`consents` (no hay otros datos de titulares).
- Panel admin de solicitudes ARCO (fase posterior si el volumen lo amerita).
- Límite al número de campañas que puede agrupar una sesión de portal (no se pagina; en la práctica el volumen por persona es bajo).
