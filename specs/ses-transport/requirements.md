# Requirements — ses-transport

Extiende `config-email-org` (D1: adaptador `SesTransport` "on-demand"). Alcance
decidido en sesión 44: **switch a nivel de plataforma por variable de entorno**,
envío vía **API SESv2 (aioboto3)**. Fuera de alcance: SES por organización
(`org_email_config.provider='ses'`), SMTP, webhooks SNS (ver design.md §Riesgos).

- **R1** — El sistema SHALL elegir el transporte por defecto de la plataforma
  según `EMAIL_PROVIDER` (`resend` | `ses`). Valor por defecto: `resend`
  (retrocompat: sin la variable nada cambia).
- **R2** — WHEN `EMAIL_PROVIDER=ses`, `platform_transport()` SHALL devolver un
  `SesTransport` que envía con SESv2 `SendEmail` (contenido simple HTML),
  respetando `from_`, `reply_to` y múltiples destinatarios, y devuelve el
  `MessageId` como `provider_id`.
- **R3** — Un valor inválido de `EMAIL_PROVIDER`, o `ses` sin región ni
  credenciales, SHALL hacer fallar el arranque con mensaje claro (como
  `HMAC_SECRET_KEY`), salvo en modo dev sin claves (log `[dev]`, igual que Resend).
- **R4** — Las ~10 guardas `if not settings.resend_api_key: return` de
  `email_service.py` SHALL reemplazarse por un helper único
  `email_enabled()` que depende del proveedor activo; con SES activo y sin
  clave Resend, ningún correo debe omitirse en silencio.
- **R5** — El remitente por defecto SHALL provenir del proveedor activo
  (`SES_FROM_EMAIL` con SES, `RESEND_FROM_EMAIL` con Resend); debe pertenecer a
  una identidad verificada en SES.
- **R6** — `SesTransport.capabilities()` SHALL exponer `daily_quota` desde
  `SES_DAILY_QUOTA` (default 200, sandbox), `monthly_quota=None`,
  `max_batch_size=1`, `supports_custom_domain=True`; y SHALL respetar
  `SES_MAX_SEND_RATE` (default 1/s) espaciando envíos para no recibir
  `Throttling`.
- **R7** — El contador de cuota SHALL usar una clave de plataforma distinta por
  proveedor, para que cambiar de Resend a SES no mezcle consumos.
- **R8** — Errores de SES (`MessageRejected`, throttling, red) SHALL devolver
  `SendResult(ok=False, error=<código>)` sin lanzar excepción ni loguear PII
  (destinatario sólo como HMAC o omitido).
- **R9** — `GET /comms/quota` SHALL reportar `provider` real del transporte
  activo de plataforma.
- **R10** — Revertir a Resend SHALL requerir sólo cambiar `EMAIL_PROVIDER` y
  `docker compose up -d --force-recreate petition-api`.
- **R11** — Las credenciales AWS SHALL ser de un usuario IAM con permiso mínimo
  `ses:SendEmail` (+ `ses:GetAccount` opcional) y nunca registrarse en logs.
