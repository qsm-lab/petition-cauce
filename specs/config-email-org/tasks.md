# Tasks — config-email-org

> No implementar hasta que el usuario apruebe esta spec (sdd:true).
> Prerrequisito lógico de `centro-comunicaciones` (remitente + cuota).

## Decisiones resueltas (sesión 37)

- ✅ Fase 1: **solo Resend**; proveedor se elige al crear la org (default
  Resend); SMTP/otros on-demand (D3, D4).
- ✅ Cifrado: **clave dedicada** `provider_secret_key`, obligatoria al arrancar
  (D6).
- ✅ Administra: **`platform_admin`** (D5).
- ✅ Orden Alembic: **038** (tras 036 embudo + 037 fix-RLS-arco, antes del centro).

## Fase 1 — Interfaz + Resend + resolución de remitente (migración 038)

### Backend — parte HECHA (sesión 37)
- [x] Interfaz `EmailTransport` + `EmailMessage`/`SendResult`/`TransportCaps`
  + registro `TRANSPORTS` + `platform_transport`/`transport_from_config`/
  `resolve_transport_for_org` con fallback a plataforma (R2, R5, R6) —
  `services/email_transport.py`.
- [x] `ResendTransport` (envuelve el POST a Resend); captura
  `x-resend-daily/monthly-quota` en `SendResult` (R2, R6). `send_batch` +
  persistencia del contador → pendiente (Fase 3 del centro).
- [x] `crypto`: `encrypt_secret`/`decrypt_secret` (`sec:v1:`) con
  `provider_secret_key` (R3, D6).
- [x] `config.py`: `provider_secret_key` (opcional con fallback a
  `pii_encryption_key` — no se pudo hacer obligatoria sin tocar `.env`; en prod
  configurar la dedicada). El Resend global es el "default de plataforma" (R5).
- [x] Modelo `org_email_config` + migración `038` con RLS (guard `NULLIF`
  correcto) (R1, R11). Verificada upgrade/downgrade/upgrade.
- [x] `email_service._send` delega en el transporte resuelto (acepta
  `transport`/`from_`/`reply_to`), fallback plataforma — **retrocompat total**
  (suite 161 passed, todos los emails intactos) (R5, R10).
- [x] Tests unitarios: cifrado en reposo y no-exposición (R3); fallback
  plataforma y proveedor desconocido (R5); capacidades free/pro (R6);
  `test_config_email_org.py` (8 passed).

### Backend — PENDIENTE (siguiente chunk)
- [x] Campos cosméticos de remitente en `campaigns.meta` (properties
  `sender_from`/`sender_reply_to`/`sender_display_name`) (R9).
- [x] Resolución de remitente con herencia campaña→org + validación de dominio
  (R9) — `resolve_sender(...)` en `email_transport.py`.
- [x] Endpoints CRUD + test de envío + rol `platform_admin`
  (`GET/PUT/DELETE /v1/admin/organizaciones/{id}/email-config` +
  `/email-config/test`) (R4, R12). Smoke test HTTP OK (crea, no expone secreto,
  delete). Rate limit del test (R13) → pendiente.
- [x] Tests con DB: cifrado en reposo + no-exposición, get/delete (RLS
  platform_admin). `test_config_email_org.py` (14 passed).
- [ ] Conectar la resolución a los flujos de email (pasar contexto campaign/org
  a los envíos) — gradual, con el centro-comunicaciones (Fase 3 del centro).
- [ ] Alta de organización captura proveedor + dominio en el mismo paso (R2b,
  D4) — backend ya lo soporta vía PUT; falta la integración en el alta (UX,
  con el frontend).
- [ ] Contador de cuota por credencial (Redis) (R7) — con el centro.
- [ ] Rate limit del endpoint de test (R13).

### Frontend — PENDIENTE
- [ ] Formulario de config de email en perfil de org (proveedor, credenciales,
  remitente por defecto, test) — evaluar Claude Design si aplica.
- [ ] Campos cosméticos de remitente en el editor de campaña (R9).

## Fase 2 — SMTP + adaptadores API nativos (on-demand, cuando una org lo pida)

- [ ] `SmtpTransport` (`aiosmtplib`, host/port/user/pass/TLS) — fallback
  universal para "servicio contratado" (R2).
- [ ] `SendgridTransport` / `MailgunTransport` / `SesTransport` según demanda
  real (cada uno cumple la interfaz; con contract test) (R2, R6).

## Cierre

- [ ] Trazabilidad R1..R13 ↔ código ↔ tests.
- [ ] Confirmar que `centro-comunicaciones` consume `capabilities().daily_quota`
  y el remitente resuelto (sin hardcodear 100/día ni `from` global).
