# Requirements — config-email-org

## Contexto

Hoy toda la plataforma envía email por un **único proveedor y credencial
globales** (`settings.resend_api_key`, `from` fijo `noreply@cauce.ec`,
`_send` en `email_service.py`). Esto no escala al modelo multi-tenant real:

- Una organización con **varias campañas** puede querer un plan Resend **Pro**
  (más cuota, dominio propio).
- Otra organización con **una sola campaña** puede bastarse con **Resend Free**.
- Otra organización puede traer un **servicio de email ya contratado** (API
  distinta de Resend: SendGrid, Mailgun, SES, o SMTP corporativo) y querer
  enviar desde ahí.

Esta feature introduce **configuración de proveedor de email por organización**
con una **abstracción de transporte multi-proveedor** (adaptadores), credenciales
cifradas en reposo, cuota por credencial y remitente heredable por campaña. Es
consumida por `centro-comunicaciones` y por todo email transaccional existente.

## Decisiones tomadas (ronda de aclaración, sesión 37)

- **D1 — Multi-API con adaptadores**: interfaz de transporte común con
  adaptadores por proveedor. SMTP genérico es el fallback universal para
  "servicios contratados".
- **D2 — Config por organización; campaña solo cosmético**: la **organización**
  define proveedor, credenciales, plan/cuota y dominios; la **campaña** solo
  ajusta `display-name` / `reply-to` / `from` **dentro de los dominios de su
  org**. Proveedor y credenciales NO se overridean por campaña.
- **D3 — Resend por defecto para todas las campañas** (estado actual: ninguna
  org usa otro proveedor). La interfaz multi-adaptador se construye, pero en
  Fase 1 **solo se implementa Resend**; SMTP y adaptadores API nativos se
  agregan cuando exista una org que los necesite, sin re-arquitectura.
- **D4 — Al crear una organización en el admin** se especifica su proveedor de
  email (default Resend) y su dominio; ahí nace su `org_email_config`.
- **D5 — Administra solo `platform_admin`** (no `org_admin`): la config de
  proveedor y sus credenciales las gestiona únicamente la plataforma.
- **D6 — Clave de cifrado dedicada** para secretos de proveedor (no reutilizar
  `pii_encryption_key`) — ver design §Cifrado para las implicaciones.

## Requisitos

### Configuración por organización
- **R1** Cada organización DEBERÁ poder tener una configuración de email activa:
  proveedor, credenciales, remitente por defecto (`from`, `reply-to`,
  display-name) y dominios de envío permitidos.
- **R2** El sistema DEBERÁ soportar los proveedores vía **adaptadores** que
  cumplen una interfaz común (D1). **Fase 1: solo Resend** (D3); la interfaz
  queda lista para SMTP genérico y adaptadores API nativos (SendGrid/Mailgun/
  SES) agregables on-demand sin tocar el resto del sistema.
- **R2b** La creación de una organización en el admin DEBERÁ capturar su
  proveedor de email (default Resend) y su dominio, materializando su
  `org_email_config` inicial (D4).
- **R3** Las **credenciales** (API keys, usuario/contraseña SMTP, secretos)
  DEBERÁN almacenarse **cifradas en reposo** (AES-256-GCM) con una **clave
  dedicada de secretos de proveedor** (D6, distinta de `pii_encryption_key`),
  nunca en texto plano, nunca en logs, y **nunca devueltas** al frontend (solo
  estado "configurado ✓" + metadatos no sensibles; para actualizar se
  re-ingresan).
- **R4** El sistema DEBERÁ permitir **probar** una configuración (envío de
  prueba a una dirección libre) antes de activarla, validando credenciales y
  remitente sin exponer secretos.
- **R5** Una organización SIN configuración propia DEBERÁ caer en el
  **proveedor/credencial de plataforma por defecto** (el Resend global actual),
  preservando el comportamiento vigente (retrocompatibilidad — ningún email
  existente se rompe).

### Capacidades y cuota por proveedor
- **R6** Cada adaptador DEBERÁ declarar sus **capacidades y límites**: cuota
  diaria/mensual, tamaño de lote (`batch`), soporte de envío programado nativo,
  soporte de dominio propio. `centro-comunicaciones` consume estos valores (no
  hardcodea 100/día).
- **R7** La **cuota** (diaria/mensual) DEBERÁ contarse **por credencial de
  proveedor** (no por campaña): varias campañas de la misma org que comparten la
  misma credencial comparten la cuota; una org con credencial propia tiene su
  propia cuota.
- **R8** La configuración DEBERÁ registrar el **plan/tier** informativo cuando
  aplique (p. ej. Resend free/pro) para derivar la cuota por defecto, permitiendo
  override manual de la cuota.

### Resolución de remitente (herencia campaña↔org, D2)
- **R9** Al enviar un email de una campaña, el sistema DEBERÁ resolver: org de la
  campaña → configuración de email de la org → adaptador + credenciales; y armar
  el remitente con el `from`/`reply-to`/display-name de la **campaña** si están
  definidos, cayendo a los de la **org**, y validando que el `from` pertenezca a
  un **dominio permitido** de la org (si no, degradar al `from` de la org +
  warning).
- **R10** `_send` (y el envío por lotes) DEBERÁN operar **a través del adaptador
  resuelto**, no del cliente Resend hardcodeado. Todos los emails existentes
  (confirmación, ARCO, lifecycle, etc.) DEBERÁN pasar por esta resolución sin
  cambio funcional cuando la org no tiene config (R5).

### Seguridad / multi-tenant
- **R11** La tabla de configuración DEBERÁ llevar **RLS** (org_id + políticas
  org/`is_platform_admin`): una org nunca ve ni usa credenciales de otra.
- **R12** Solo `platform_admin` DEBERÁ poder ver/editar la configuración de
  email de cualquier organización (D5); nunca ver el secreto en claro. (RLS
  igualmente en la tabla por defensa en profundidad, R11.)
- **R13** El endpoint de prueba (R4) DEBERÁ tener rate limiting (HMAC) para no
  convertirse en un relay de spam vía credenciales de terceros.

## Fuera de alcance

- Verificación automática de dominios en el proveedor (DKIM/SPF/DMARC) — se
  asume el dominio ya verificado por fuera; la config solo lo registra.
- UI de analítica de entregabilidad por proveedor (aperturas/rebotes) más allá
  de exponer lo mínimo.
- Rotación automática de credenciales.
- Múltiples configuraciones activas simultáneas por org (MVP: una activa).

## Tests (resumen)
- Credencial se cifra en reposo y nunca se devuelve en claro (R3).
- Org sin config usa el default de plataforma sin romperse (R5, R10).
- Resolución de remitente aplica herencia campaña→org y valida dominio (R9).
- Cuota se cuenta por credencial, no por campaña (R7).
- RLS impide ver/usar config de otra org (R11).
- Adaptador SMTP y Resend cumplen la misma interfaz (contract test) (R2, R6).
