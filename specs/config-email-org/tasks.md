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
  Nota sesión 38: NO es un bloqueante real para arrancar el centro — su propio
  código nuevo puede llamar a `resolve_transport_for_org`/`resolve_sender`
  directo desde el día uno, sin depender de que los ~15 flujos legacy migren.
- [x] Alta de organización captura proveedor + dominio en el mismo paso (R2b,
  D4) — sesión 38: `OrganizationService.create_organization` materializa el
  `org_email_config` inicial (provider=resend, `allowed_domains=[domain]`, sin
  credenciales/`default_from` — evita spoofing de remitente en un dominio no
  autenticado hasta que se configure de verdad). Test `test_config_email_org.py`
  + verificado con HTTP real (crea org → GET email-config da 200).
- [x] Contador de cuota por credencial (Redis) (R7) — sesión 38:
  `services/email_quota.py` (`record_usage`/`get_usage`), provider-agnóstico
  (`mail:quota:<config_id>:<día/mes>`) + snapshot de headers Resend
  (`mail:resend-quota:<config_id>`). Conectado en `_send()` (nuevo parámetro
  `quota_key`) y en `send_test()`. Expuesto en `OrgEmailConfigResponse`
  (`daily_used`/`monthly_used`/`provider_snapshot`). `test_email_quota.py`
  (5 tests, sin golpear la red real de Resend — transporte falso).
- [x] Rate limit del endpoint de test (R13) — sesión 38: `@limiter.limit("5/minute")`
  en `POST .../email-config/test` (mismo patrón slowapi que el resto de la API).
  Verificado con HTTP real: 6 intentos seguidos → el 6º da 429.

### Frontend — HECHO (sesión 38)
- [x] Formulario de config de email en perfil de org (proveedor, credenciales,
  remitente por defecto, test, eliminar) — nueva card en
  `OrgDetailClient.tsx`/`OrgEmailConfigCard.tsx` (`/admin/organizaciones/[id]`),
  reutiliza el patrón visual de las cards existentes en esa página. Diseño
  aprobado en `design-export.html` (2 frames: vista sin/con config + edición)
  antes de implementar, por regla del proyecto. La pill "Resend · configurada"
  usa `has_credentials` (no solo "existe una fila de config") para no ser
  engañosa con el shell que R2b crea sin credenciales. Verificado end-to-end
  con Playwright: sin config → configurar → guardar → ver datos → recargar
  (persiste) → eliminar → vuelve a plataforma (persiste tras reload también).
- [ ] Campos cosméticos de remitente en el editor de campaña (R9) — pendiente,
  no se abordó esta sesión (fuera del alcance elegido por el usuario).

## Fase 2 — SMTP + adaptadores API nativos (on-demand, cuando una org lo pida)

- [ ] `SmtpTransport` (`aiosmtplib`, host/port/user/pass/TLS) — fallback
  universal para "servicio contratado" (R2).
- [ ] `SendgridTransport` / `MailgunTransport` / `SesTransport` según demanda
  real (cada uno cumple la interfaz; con contract test) (R2, R6).

## Cierre

- [ ] Trazabilidad R1..R13 ↔ código ↔ tests.
- [ ] Confirmar que `centro-comunicaciones` consume `capabilities().daily_quota`
  y el remitente resuelto (sin hardcodear 100/día ni `from` global).
