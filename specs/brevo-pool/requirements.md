# Requirements — brevo-pool

Extiende `config-email-org` / `ses-transport`. Plan B de entrega mientras SES
sigue en sandbox. Decisiones (sesión 44): **Brevo vía API v3 con httpx** (sin
dependencia nueva) y **reparto por cuota en la cola** de `centro-comunicaciones`
entre varios proveedores de plataforma. Fuera de alcance: SMTP genérico, SES por
organización, UI del reparto, envíos transaccionales repartidos (R12).

- **R1** — `EMAIL_PROVIDER` SHALL aceptar también `brevo`. `BrevoTransport`
  SHALL enviar con `POST https://api.brevo.com/v3/smtp/email` (header `api-key`),
  mapeando `from_` ("Nombre <correo>") a `sender`, `reply_to` a `replyTo`,
  destinatarios a `to`, y devolver `messageId` como `provider_id`.
- **R2** — Errores de Brevo SHALL devolver `SendResult(ok=False, error=...)` sin
  lanzar excepción: `http_<código>`; el 429 como `rate_limited`. La API key
  nunca se registra en logs.
- **R3** — Settings: `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_DAILY_QUOTA`
  (default 300; **el usuario verifica el tope real de su cuenta**). Sin clave en
  dev: log `[dev]`, como Resend.
- **R4** — `email_enabled()` y `default_from_email()` SHALL contemplar `brevo`.
- **R5** — `EMAIL_POOL` (lista ordenada, separada por comas, p. ej.
  `brevo,resend`) SHALL definir los proveedores de plataforma que usa la cola.
  Vacía = comportamiento actual (solo `EMAIL_PROVIDER`). Valores inválidos,
  repetidos o sin credenciales SHALL fallar al arrancar.
- **R6** — WHEN una campaña usa el default de plataforma (sin
  `org_email_config` activa), la cola SHALL repartir cada lote entre los
  proveedores del pool en orden, consumiendo el cupo diario restante de cada uno
  (`daily_quota − usado hoy`, contador Redis por proveedor). El resto del lote
  pasa a un lote `pending` nuevo (mecanismo D4 existente).
- **R7** — Un destinatario SHALL enviarse por exactamente un proveedor: cada
  `signature_id` se procesa una sola vez; no hay failover por mensaje.
- **R8** — Los lotes de una campaña CON `org_email_config` activa SHALL seguir
  usando solo esa configuración (sin pool).
- **R9** — El tamaño de lote en la expansión SHALL derivarse de la suma de cupos
  diarios del pool (o el tope fijo si algún miembro no declara tope).
- **R10** — La clave de cuota de plataforma SHALL ser distinta por proveedor
  (`platform`, `platform-ses`, `platform-brevo`).
- **R11** — `GET /comms/quota` SHALL incluir, aditivamente, el detalle por
  proveedor del pool (nombre, usado, cupo, remitente). Sin cambios de UI en v1.
- **R12** — Los correos transaccionales (confirmación, ARCO, avisos) SHALL
  seguir usando solo `EMAIL_PROVIDER` en v1.
- **R13** — Los tests SHALL bloquear envíos reales de Brevo (extensión de la
  fixture autouse existente).
- **R14** — Revertir SHALL requerir solo vaciar `EMAIL_POOL` / cambiar
  `EMAIL_PROVIDER` y `--force-recreate`, **sin envío masivo en curso**.
- **R15** — (añadido al aprobar) `RESEND_DAILY_QUOTA` (opcional) SHALL sobrescribir
  el cupo diario de Resend de plataforma. Resend tolera envíos sobre los 100/día
  del plan Free (hallazgo empírico, no documentado); se usa un valor conservador
  (150 = 100 + la mitad del exceso observado). Capacidad prevista del pool
  `brevo,resend`: 300 + 150 = 450/día → ~2.200 destinatarios en 5 días.
