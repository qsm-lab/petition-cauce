# Design — config-email-org

## Arquitectura

```
Envío (cualquier email de campaña)
   │
   ▼
resolve_transport(campaign) ──► org ──► OrgEmailConfig activa? 
   │                                        │ sí            │ no
   │                                        ▼               ▼
   │                              adaptador(provider,   PlatformDefault
   │                              creds descifradas)    (Resend global actual)
   ▼
EmailTransport (interfaz común)
   ├─ ResendTransport      (API)
   ├─ SmtpTransport        (SMTP genérico — fallback universal)
   ├─ SendgridTransport    (API, on-demand)
   ├─ MailgunTransport     (API, on-demand)
   └─ SesTransport         (API, on-demand)
        │
        ├─ send(msg) / send_batch(msgs)
        └─ capabilities(): daily_quota, monthly_quota, max_batch, 
                           supports_scheduled, supports_custom_domain
```

## Interfaz de transporte (D1, R2, R6)

```python
class EmailMessage:      # from_, reply_to, to[], subject, html
class SendResult:        # ok, provider_id|None, error|None
class TransportCaps:     # daily_quota, monthly_quota, max_batch_size,
                         # supports_scheduled, supports_custom_domain

class EmailTransport(Protocol):
    async def send(self, msg: EmailMessage) -> SendResult: ...
    async def send_batch(self, msgs: list[EmailMessage]) -> list[SendResult]: ...
    def capabilities(self) -> TransportCaps: ...
```

- **ResendTransport**: envuelve el POST actual a `api.resend.com` (reusa la
  lógica de `_send`); `send_batch` usa `/emails/batch` (≤100). Caps derivadas
  del plan (free: 3000/mes, 100/día, batch 100; pro: 50000/mes, sin límite
  diario).
- **SmtpTransport**: `aiosmtplib` sobre host/port/user/pass/TLS de la config.
  Cubre "servicio contratado" genérico. Sin cuota impuesta por el adaptador
  (o la que el admin declare, R8); `supports_custom_domain=True`.
- **Sendgrid/Mailgun/Ses**: adaptadores API nativos, se agregan on-demand
  cumpliendo la interfaz; **no se implementan todos en Fase 1** (ver tasks —
  Resend + SMTP primero; los demás según qué org concreta los necesite).

Registro: `TRANSPORTS = {"resend": ResendTransport, "smtp": SmtpTransport, ...}`
— `resolve_transport` instancia por `provider` con las credenciales descifradas.

## Resolución de remitente (D2, R9)

```
from        = campaign.sender_from      or org_cfg.default_from
reply_to    = campaign.sender_reply_to  or org_cfg.default_reply_to
display     = campaign.sender_display   or org.name
validate: dominio(from) ∈ org_cfg.allowed_domains  → si no, from = org default + warning
header From = f'{display} <{from}>'
```

Proveedor y credenciales SIEMPRE de la org (nunca de la campaña, D2).

## Modelo de datos

### `org_email_config` (RLS por org_id)
- `id`, `org_id` (FK, unique — una config activa por org en MVP)
- `provider` (`resend|smtp|sendgrid|mailgun|ses`)
- `credentials_encrypted` (TEXT, AES-256-GCM de un JSON con lo que el proveedor
  necesita: `{api_key}` o `{host,port,user,pass,tls}` …) (R3)
- `plan` (`free|pro|null`, informativo) (R8)
- `daily_quota`, `monthly_quota` (int, override o derivado del plan) (R7,R8)
- `default_from`, `default_reply_to`, `default_display_name`
- `allowed_domains` (JSONB; o reutilizar `organization.domains`)
- `status` (`active|disabled`), `verified_at`, timestamps, `created_by`

### Campos de remitente cosmético en `campaigns` (o `meta`)
- `sender_from`, `sender_reply_to`, `sender_display_name` (opcionales; heredan
  de la org si null) (R9)

### Contador de cuota (R7)
- Redis `mail:quota:<org_email_config_id>:<yyyy-mm-dd>` (+ mensual), o tabla si
  se prefiere persistencia auditada. Clave por **credencial/config**, no por
  campaña. El default de plataforma cuenta contra su propia clave global.

## Cifrado de credenciales (R3, D6)

Se reutiliza la **primitiva** de `crypto.py` (AES-256-GCM, formato `enc:v1:...`)
pero con una **clave dedicada** `provider_secret_key`, no `pii_encryption_key`.

**Implicaciones de la decisión (por qué clave dedicada):**
- **Separación de dominios de seguridad**: las credenciales de proveedor son
  secretos de infraestructura de terceros (subencargados), semánticamente
  distintos de la PII de titulares (cédula/email). Con clave dedicada, cada uno
  tiene su ciclo de vida.
- **Blast radius acotado**: comprometer/rotar una clave no expone ni obliga a
  re-cifrar lo protegido por la otra. Si hay que rotar `pii_encryption_key` por
  un incidente con PII de firmantes, no hay que tocar las credenciales de
  proveedores de todas las orgs (y viceversa).
- **Coherencia con el proyecto**: ya se separan claves por propósito
  (`HMAC_SECRET_KEY` ≠ `pii_encryption_key`); esta sigue el mismo principio.
- **Costo**: un secreto más en `.env`/config, **obligatorio al arrancar** (como
  `HMAC_SECRET_KEY`), hex de 32 bytes. Es el único costo real; bajo.
- Contrapartida de reutilizar `pii_encryption_key`: cero config nueva, pero
  acopla PII de titulares con credenciales de infraestructura bajo un mismo
  secreto — se descarta por higiene de seguridad.

**Manejo:**
- Funciones `encrypt_secret`/`decrypt_secret` en `crypto.py` que usan
  `provider_secret_key`.
- Nunca loguear ni serializar el secreto; el schema de salida expone solo
  `{provider, plan, default_from, has_credentials: true, status}`.

## Lectura de cuota en tiempo real (Resend)

Resend **no** tiene endpoint de solo-lectura de uso, pero **cada respuesta de
envío** incluye headers de consumo del plan:
- `x-resend-daily-quota` (cuota diaria usada — **solo plan free**)
- `x-resend-monthly-quota` (cuota mensual usada)
- `ratelimit-remaining` / `retry-after` (rate limit **10 req/s** por team)

`ResendTransport.send`/`send_batch` DEBEN capturar estos headers y persistir el
último valor visto (Redis `mail:resend-quota:<config_id>`) con timestamp, para
que `centro-comunicaciones` lo muestre en el admin ("cuota usada, actualizado al
último envío"). El throttling de la cola respeta `ratelimit-remaining`/
`retry-after` para no exceder 10 req/s. `TransportCaps.daily_quota` da el techo;
el header da el consumido. (SMTP/otros adaptadores no exponen esto → se cae al
contador propio por credencial, R7.)

## Interacción con `centro-comunicaciones`

- El **remitente** de cada envío lo resuelve esta feature (R9).
- La **cola multi-día** del centro consume `capabilities().daily_quota` del
  transporte de la org (no hardcodea 100/día) y el contador por credencial (R7).
- El **batch** usa `send_batch` del adaptador (tamaño = `max_batch_size`).
- Envío programado: si el adaptador soporta `scheduled` nativo, es opcional
  usarlo; el diseño base sigue con el loop in-process del centro (más portable
  entre proveedores).

## Archivos afectados

### Backend
- `apps/api/app/services/email/transport.py` — interfaz + `resolve_transport` +
  registro.
- `apps/api/app/services/email/providers/{resend,smtp,...}.py` — adaptadores.
- `apps/api/app/services/email_service.py` — `_send`/builders pasan por el
  transporte resuelto (R10); mantener firma pública para no tocar los ~15
  llamadores existentes (inyectar `campaign`/`org` para resolver, con fallback
  a plataforma cuando no hay contexto — R5).
- `apps/api/app/models/org_email_config.py` + migración (RLS).
- Campos de remitente en `campaign.py` + migración.
- `apps/api/app/crypto.py` — `encrypt_secret`/`decrypt_secret` (opcional).
- `apps/api/app/routers/org_email_config.py` — CRUD + test de envío (R4),
  JWT + rol (R12), rate limit (R13).
- `apps/api/app/config.py` — el Resend global pasa a ser el "default de
  plataforma".

### Frontend
- Sección en el perfil de organización (o admin de plataforma) para configurar
  proveedor + credenciales + remitente + test. (Requiere Claude Design si es
  pantalla nueva relevante — evaluar; puede ser un formulario simple dentro de
  `perfiles-org`.)
- Campos cosméticos de remitente en el editor de campaña.

## Seguridad / LOPDP

- Credenciales cifradas en reposo (R3), RLS (R11), acceso restringido (R12),
  test rate-limited (R13).
- El proveedor de email es un **subencargado** del tratamiento (LOPDP): si una
  org trae su propio proveedor, ese proveedor procesa PII (emails de firmantes)
  bajo la responsabilidad de la org. Nota de cumplimiento: la config debería
  poder registrar que existe base contractual con ese subencargado (campo/nota),
  aunque la verificación formal es responsabilidad de la org (Responsable).
- Cambiar el proveedor de una org afecta la entregabilidad de sus emails —
  requiere el test (R4) antes de activar.

## Dependencias / orden de Alembic

**Prerrequisito lógico** de `centro-comunicaciones` (remitente + cuota); el
centro consume su interfaz. Reutiliza `crypto.py` y `organization.domains`.

**Migraciones pendientes de las 3 specs de la sesión (head actual = 035):**
| Feature | Migración(es) | Comparte tabla con otra? |
|---|---|---|
| `embudo-post-firma` | `signatures.newsletter_token` + `consents.notify_updates_at` | No |
| `config-email-org` | `org_email_config` (nueva) + `campaigns.sender_*` (cosmético) | No |
| `centro-comunicaciones` | `comms_upload`, `scheduled_send`, `send_batch`, `send_log` (Fase 3) | No |

**Implicaciones:** ninguna comparte tablas con otra → no hay conflicto lógico de
schema; el único riesgo es **heads divergentes** si se desarrollan en paralelo
sin serializar el merge a `dev` (rompería `alembic upgrade head` en deploy). Por
eso: head lineal, una feature se mergea antes de que la siguiente numere.

**Mejor orden:**
1. `embudo-post-firma` → **036** (la más chica, spec madura, independiente).
2. `config-email-org` → **038** (`org_email_config` + `campaigns.sender_*`;
   prerrequisito del centro, tabla autocontenida).
3. `centro-comunicaciones` → **039+** (sus tablas de cola/upload llegan recién
   en Fase 3, naturalmente después; los `campaigns.sender_*` ya existen desde
   038, así que el centro no agrega columnas de remitente).

Este orden respeta las dependencias lógicas (config-email-org antes que el
centro) y mantiene un head lineal sin migraciones de merge.

## Puntos abiertos — RESUELTOS (sesión 37)
- ✅ Adaptadores Fase 1: **solo Resend** (ninguna org usa otro proveedor aún);
  el proveedor se elige al crear la org (default Resend). SMTP/otros on-demand
  (D3, D4).
- ✅ Cifrado: **clave dedicada** `provider_secret_key` (D6, ver §Cifrado).
- ✅ Administra: **`platform_admin`** (D5).
- ✅ Orden Alembic: **036 embudo → 037 fix-RLS-arco → 038 config-email → 039+ centro** (arriba).
