# Design — retencion-datos

## Decisiones

### Mecanismo de ejecución (R1, R8)
- **APScheduler** (`AsyncIOScheduler`) dentro del proceso FastAPI, arrancado en el lifespan. Sin servicios nuevos en el VPS (restricción CLAUDE.md), sin celery.
- Corrida diaria 03:00 America/Guayaquil.
- Lock en Redis (`petition:retention:lock`, TTL 1h, `SET NX`) — si otra instancia lo tiene, la corrida se salta (R8).
- Dependencia nueva: `apscheduler` en `requirements.txt`.

### Ancla del plazo (R2)
```
ancla = fecha del primer LifecycleEvent con stage == etapa 'entrega' de la campaña
        (si existe) — si no, signature.created_at
expira = ancla + privacy_config.retention_days
```
- Racional: mientras la campaña recolecta, las firmas deben seguir siendo verificables; tras la entrega del expediente empieza el plazo real de conservación declarado.
- Campañas sin `privacy_config`: usar default 365 días con warning en el log de auditoría.

### Anonimización (R3, R4, R5)
- Nueva columna `signatures.anonymized_at TIMESTAMPTZ NULL` (migración).
- Campos a NULL: `name`, `org_name`, `org_name_hash`, `cedula_encrypted`, `cedula_hash`, `ip_hmac`, `confirmation_token`.
- `email_encrypted` → tombstone `"anonymized"` y `email_hash` → `"anonymized:" + uuid4().hex` (la columna es NOT NULL y el hash único evita colisiones con dedup de firmas activas).
- `consents.ip_hmac` → NULL para consents de firmas anonimizadas; el resto del consent se conserva (prueba de consentimiento, R5).
- UPDATE por lotes (500) para no bloquear la tabla.

### Auditoría (R6)
Nueva tabla `retention_runs`:
```
id UUID PK, started_at, finished_at, trigger ('scheduled'|'manual'),
campaigns_evaluated INT, signatures_anonymized INT,
detail JSONB  -- [{campaign_id, anonymized_count}]
```

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `apps/api/app/models/signature.py` | columna `anonymized_at` |
| `apps/api/app/models/retention_run.py` | nuevo modelo |
| `apps/api/migrations/versions/016_retention.py` | `anonymized_at` + tabla `retention_runs` |
| `apps/api/app/services/retention_service.py` | nuevo: cálculo de ancla, anonimización por lotes, auditoría |
| `apps/api/app/scheduler.py` | nuevo: APScheduler + lock Redis |
| `apps/api/app/main.py` | lifespan: arrancar/parar scheduler |
| `apps/api/app/routers/admin_retention.py` | nuevo: `POST /v1/admin/retention/run` (rol admin) |
| `apps/api/requirements.txt` | `apscheduler` |
| `apps/api/tests/test_retention.py` | tests R11 |

## Seguridad

- Endpoint manual: JWT + rol `admin` + rate limit.
- El log de auditoría solo contiene conteos e IDs de campaña — nunca PII (R6).
- El lock Redis usa el prefijo `petition:` (aislamiento de forms-qsm).

## LOPDP

- Ejecuta el principio de **limitación del plazo de conservación**: el dato se conserva solo el plazo declarado en el aviso de privacidad de cada campaña (`privacy_config.retention_days`).
- La anonimización es irreversible (no hay tabla espejo): cumple como alternativa a supresión permitida cuando se conserva valor estadístico.
- `retention_runs` sirve como evidencia de cumplimiento ante la SPDP.
- El RAT (rat-autogenerado) debe declarar el plazo y el mecanismo.

## Dependencias

- Independiente de cifrado-reposo (anonimiza el campo, cifrado o no), pero se recomienda implementar **después** para no tocar `signature_service` en paralelo.
