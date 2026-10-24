# Design — brevo-pool

## Archivos afectados
- `app/config.py` — `brevo_*`, `email_pool` (+ validación de arranque, R5).
- `app/services/email_transport.py` — `BrevoTransport`; `platform_transport_for(name)`
  (fábrica por nombre; `platform_transport()` la usa con `EMAIL_PROVIDER`);
  `platform_pool()` → lista de `PoolMember(name, transport, quota_key, daily_quota)`.
- `app/services/email_quota.py` — `platform_quota_key(name=None)` (R10).
- `app/services/comms_queue_service.py` — `_resolve_email_context` devuelve el
  pool (1 miembro = comportamiento actual); `_process_claimed_batch` reparte (R6);
  la expansión usa la suma de cupos (R9).
- `app/routers/campaigns.py` + `schemas` — campo aditivo `pool` en `/comms/quota` (R11).
- `.env.example`, `tests/conftest.py`, `tests/test_brevo_pool.py`.
- **Sin migración**: el reparto reutiliza `send_batch` y el lote-resto existente.

## Algoritmo de reparto (R6, R7)
```
ids = lote reclamado
for m in pool (en orden):
    remaining = None si m.daily_quota es None else max(m.daily_quota − usado_hoy(m), 0)
    if remaining == 0: continue
    take = ids[:remaining] (o todos si None)
    enviar `take` con m.transport, quota_key=m.quota_key
    ids = ids[len(take):]
    if not ids: break
si ids queda → lote `pending` nuevo con el resto (ya existente)
si ningún miembro tenía cupo → liberar el lote a `pending` (ya existente)
```
Un destinatario cae en un solo `take`; no hay reintento entre proveedores.

## BrevoTransport
- Cuerpo: `sender{name,email}` (de `email.utils.parseaddr(from_)`), `to[{email}]`,
  `subject`, `htmlContent`, `replyTo{email}`. Respuesta 201 `{messageId}`.
- Un `httpx.AsyncClient` por envío (igual que Resend), timeout 10 s.
- Brevo no devuelve cuota por header → contador Redis propio.

## Seguridad / LOPDP
- Brevo se suma como **subencargado** (otro tratamiento de emails de firmantes):
  anotarlo en RAT y contratos de encargo; firmar el DPA de Brevo.
- API key solo en `.env`; en Brevo, restringir por IPs autorizadas (IP del VPS).
- Sin PII nueva en DB ni logs.

## Riesgos
- **Cuenta de Resend compartida con listmonk** (`frontera_boletin_listmonk.md`):
  el contador solo ve envíos de esta app; el boletín puede agotar la cuota sin
  que la cola lo sepa. Mitigación: ordenar el pool con Brevo primero.
- **Autenticación del dominio en Brevo** (DKIM/código/DMARC en Cloudflare) y la
  revisión de la cuenta pueden demorar: es la ruta crítica.
- Sin `List-Unsubscribe` (EmailMessage no tiene headers): igual que Resend/SES.
- Cambiar el pool con un envío masivo en curso: prohibido (incidente sesión 42).
- **Pixel de seguimiento de Brevo** (verificado 2026-10-24): el relay inyecta un
  pixel de aperturas (`r.camp.ecuadornotlc.org/tr/op/...`) y `List-Unsubscribe`
  propio en los correos transaccionales; desactivar un ajuste en la cuenta no lo
  quitó. Implica registro de IP/fecha/cliente por Brevo (subencargado). Documentar
  en RAT y contrato de encargo, o enviar solo por Resend. Pendiente de decisión.
  Detalle y decisión pendiente en `docs/legal/subencargados_email.md`.
