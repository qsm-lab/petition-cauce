# Design — ses-transport

## Archivos afectados
- `apps/api/requirements.txt` — `aioboto3` (versión fija).
- `apps/api/app/config.py` — `email_provider`, `aws_region`, `aws_access_key_id`,
  `aws_secret_access_key`, `ses_from_email`, `ses_configuration_set` (opcional),
  `ses_daily_quota`, `ses_max_send_rate`; validación al arranque (R3).
- `apps/api/app/services/email_transport.py` — `SesTransport`; registrar
  `TRANSPORTS["ses"]`; `platform_transport()` ramifica por `email_provider`;
  helper `email_enabled()` y `default_from_email()`.
- `apps/api/app/services/email_service.py` — sustituir guardas (R4) y
  `settings.resend_from_email` por `default_from_email()`.
- `apps/api/app/services/email_quota.py` — clave de plataforma por proveedor (R7).
- `apps/api/app/routers/campaigns.py` — `provider` real en `/comms/quota` (R9).
- `.env.example` — bloque SES (el usuario edita `.env`; Claude no lo toca).
- `apps/api/tests/test_ses_transport.py` — cliente SES mockeado, sin red.

## Decisiones
- **D1** Switch global, no por org: `org_email_config` con provider `resend`
  sigue funcionando; orgs sin config usan el proveedor global activo.
- **D2** `aioboto3` (async, consistente con el resto) en vez de boto3 bloqueante
  en el loop del scheduler. Cliente creado por envío con `async with`.
- **D3** Sin `send_batch`: SESv2 `SendEmail` es por mensaje; el loop de
  `comms_queue_service` ya envía secuencialmente. Throttle por
  `SES_MAX_SEND_RATE`. El tamaño de lote diario se deriva de `daily_quota`
  (sandbox 200 → cola multi-día automática, R13 del centro).
- **D4** Cuota: SES no devuelve headers de consumo; se usa el contador Redis
  local. `GetAccount` (Max24HourSend/SentLast24Hours) queda como mejora
  opcional para sincronizar `SES_DAILY_QUOTA` real.
- **D5** Sin Configuration Set en v1 salvo que se defina `SES_CONFIGURATION_SET`.

## Seguridad / LOPDP
- Sin migración ni columnas PII nuevas. AWS pasa a ser **subencargado** de
  tratamiento (emails de firmantes): registrar en RAT/contratos de encargo y
  elegir región (us-east-1 vs sa-east-1) con criterio de transferencia
  internacional; Resend ya implica transferencia equivalente.
- Credenciales sólo en `.env` del VPS; usuario IAM dedicado, política mínima
  restringida a la identidad verificada (`ses:FromAddress`).
- Logs: sin destinatarios en claro.

## Riesgos
- **Rebotes/quejas**: SES suspende cuentas con bounce >5% / queja >0,1%.
  Sin webhook SNS no hay supresión automática. Recomendado como feature
  siguiente (`ses-bounce-handling`: SNS→endpoint→lista de supresión).
  Mitigación v1: monitoreo en consola SES + no migrar el envío masivo hasta
  tener producción aprobada y warm-up.
- **Cabeceras** `List-Unsubscribe`: `EmailMessage` no tiene headers; el pie de
  desuscripción en HTML existe. Pendiente igual que con Resend.
- Aislar de otras guardas: tests existentes que monkeypatchean
  `settings.resend_api_key` deben seguir pasando (helper lo respeta con
  `email_provider=resend`).
