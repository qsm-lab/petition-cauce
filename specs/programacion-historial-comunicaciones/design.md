# Design — programacion-historial-comunicaciones

## Flujo

```
[Admin] cualquier tab del popup (evento / cierre / mensaje)
  → completa el formulario (igual que hoy)
  → en vez de "Enviar a firmantes", elige fecha/hora y click "Programar"
      → POST /v1/campaigns/{cid}/lifecycle/schedule-email
          { type: "event_invitation"|"closing_notification"|"message",
            payload: {...mismos campos que el endpoint de envío real...},
            test_emails?: [...], scheduled_at: "2026-08-01T09:00:00Z" }
      → INSERT scheduled_email (status='pending')
      ← { id, scheduled_at }

[Loop en segundo plano] cada 60s (arrancado en el lifespan de FastAPI)
  → SELECT ... WHERE status='pending' AND scheduled_at <= now()
  → por cada uno: UPDATE ... SET status='sending' WHERE id=... AND status='pending' RETURNING id
      (claim atómico — si no devuelve fila, otro worker ya lo tomó, se salta)
  → reconstruye el email según `type` con las MISMAS funciones ya existentes
    (send_delivery_event_invitation_email / send_campaign_closing_email /
     send_lifecycle_signer_notification)
  → éxito: UPDATE status='sent', sent_count=N, sent_at=now()
           + INSERT email_send_log (sent_by=NULL → "programado")
  → error: UPDATE status='failed', error=str(exc)  (R6, sin reintento)

[Admin] tab "Historial" (nueva, 4ta pestaña del popup)
  → GET /v1/campaigns/{cid}/lifecycle/email-log      (envíos ya realizados)
  → GET /v1/campaigns/{cid}/lifecycle/scheduled-emails (pendientes, con botón Cancelar)
  → DELETE /v1/campaigns/{cid}/lifecycle/scheduled-emails/{id}  (solo si pending)
```

Todo envío real inmediato (los 4 endpoints ya existentes: event-invitation,
closing-notification, notify-signers) también hace un `INSERT
email_send_log` justo después de enviar exitosamente — no solo los
programados.

## Modelo

### Migración nueva (primera de esta rama)

```sql
CREATE TABLE scheduled_email (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  type            VARCHAR(20) NOT NULL,   -- event_invitation | closing_notification | message
  payload         JSONB NOT NULL,          -- campos del request original (sin test_emails)
  test_emails     JSONB,                   -- null si es envío real
  scheduled_at    TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending|sending|sent|failed|cancelled
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  sent_count      INTEGER,
  error           TEXT
);

CREATE TABLE email_send_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES campaigns(id),
  org_id              UUID NOT NULL REFERENCES organizations(id),
  type                VARCHAR(20) NOT NULL,
  subject             TEXT NOT NULL,
  mode                VARCHAR(10) NOT NULL,  -- test | real
  recipient_count     INTEGER NOT NULL,
  sent_by             UUID REFERENCES users(id),  -- NULL = disparado por el scheduler
  scheduled_email_id  UUID REFERENCES scheduled_email(id),
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS: mismo patrón que `pii_export_audit` (org_id directo + política
org-scope / `app.is_platform_admin`).

**`payload` JSONB, no columnas propias por campo** — evita 3 tablas
distintas por tipo o una tabla con 15 columnas nullable. El `type` decide
qué campos se esperan dentro; la validación vive en el service, no en la
DB.

## Archivos afectados

### Backend
| Archivo | Cambio |
|---------|--------|
| `apps/api/migrations/versions/0XX_scheduled_email_and_log.py` | 2 tablas + RLS |
| `apps/api/app/models/scheduled_email.py` | nuevo |
| `apps/api/app/models/email_send_log.py` | nuevo |
| `apps/api/app/schemas/email_scheduling.py` | `ScheduleEmailRequest` (type, payload, test_emails?, scheduled_at) |
| `apps/api/app/services/email_scheduling_service.py` | nuevo: `create_scheduled_email`, `list_scheduled_emails`, `cancel_scheduled_email`, `claim_due_scheduled_emails` (atómico), `dispatch_scheduled_email` (reconstruye y llama a la función de envío correcta según `type`) |
| `apps/api/app/services/email_log_service.py` | nuevo: `log_send(...)` |
| `apps/api/app/services/email_scheduler_runner.py` | nuevo: loop asíncrono (60s), arrancado/detenido desde `lifespan` en `main.py` — nombre distinto a `scheduler.py` de `dev` a propósito, para no chocar si se mergea después (ver R16) |
| `apps/api/app/routers/campaigns.py` | 4 endpoints: `POST .../schedule-email`, `GET .../scheduled-emails`, `DELETE .../scheduled-emails/{id}`, `GET .../email-log`; + una línea de `log_send(...)` al final de cada uno de los 4 endpoints de envío ya existentes |
| `apps/api/app/main.py` | arrancar/detener el loop en `lifespan` |
| `apps/api/tests/test_email_scheduling.py` | R17, R18, R19 |

### Frontend
| Archivo | Cambio |
|---------|--------|
| `apps/web/src/lib/admin-lifecycle-api.ts` | `scheduleEmail(...)`, `listScheduledEmails(...)`, `cancelScheduledEmail(...)`, `listEmailLog(...)` |
| `apps/web/src/app/admin/campanas/[id]/AdherentCommsModal.tsx` | cada tab suma selector de fecha/hora + botón "Programar" junto a "Enviar a firmantes"; lista de programados pendientes con "Cancelar" al pie de cada tab |
| `apps/web/src/app/admin/campanas/[id]/EmailHistoryTab.tsx` | nuevo — 4ta pestaña del popup, lista el historial (`GET .../email-log`) |

## Seguridad

- Mismo patrón de auth/scope que el resto: JWT + rol + `_org_scope`.
- El claim atómico (R4) evita doble envío si en producción llegan a correr
  múltiples workers de uvicorn — `UPDATE ... WHERE status='pending'
  RETURNING id` es la única fuente de verdad de "quién se lo quedó".
- El loop del scheduler corre con una sesión de DB propia (no reutiliza la
  del request) — mismo patrón que tendría cualquier job en background.

## LOPDP

- El historial (`email_send_log`) NO guarda PII ni contenido del email —
  solo metadatos operativos (tipo, asunto, conteo, quién, cuándo), mismo
  criterio que `pii_export_audit`.
- `scheduled_email.payload` sí puede contener texto libre escrito por el
  admin (mensaje, lugar del evento) pero nunca PII de firmantes — la
  audiencia se resuelve recién al momento de disparar, no se guarda de
  antemano.
- Sin cambios de base legal: es infraestructura operativa sobre
  comunicaciones ya aprobadas en `comunicaciones-cierre-campana`.

## Dependencias

- Reusa las funciones de armado/envío ya existentes de
  `comunicaciones-cierre-campana` — no se reimplementa nada de HTML.
- Primera migración de esta rama (`feat/comunicaciones-cierre-campana`,
  partida de `main`) — coordinar con el usuario el orden de merge respecto
  a la cadena de `dev` (retención/supresión/ARCO, con sus propias
  migraciones) para evitar dos heads de Alembic simultáneos.
