# Tasks — retencion-datos

## Migración y modelos

- [x] **T1** Migración `018_retention.py` (016 y 017 ya estaban tomadas al momento de implementar): columna `signatures.anonymized_at` + tabla `retention_runs` (R3, R6)
- [x] **T2** Modelo `RetentionRun` + columna en modelo `Signature`

## Servicio

- [x] **T3** `retention_service.get_campaign_anchor` + `compute_expiry` — ancla evento `entrega` o `created_at` (R2)
- [x] **T4** `retention_service.anonymize_signature(sig, now)` — campos a NULL/tombstone según design (R3, R4)
- [x] **T5** `retention_service.run_retention(db, trigger)` — evalúa campañas, lotes de 500, excluye `anonymized_at IS NOT NULL`, anonimiza `consents.ip_hmac`, registra `RetentionRun` (R1, R5, R6, R7)

## Scheduler y endpoint

- [x] **T6** `scheduler.py`: AsyncIOScheduler, corrida diaria 03:00 Guayaquil, lock Redis `petition:retention:lock` SET NX TTL 1h (R1, R8) — el lock también se usa en el endpoint manual para cubrir R8 entre ambos triggers
- [x] **T7** `main.py`: integrar scheduler en lifespan (start/shutdown limpio)
- [x] **T8** `admin_retention.py`: `POST /v1/admin/retention/run` — JWT admin, responde resumen de la corrida (R9)
- [x] **T9** `requirements.txt`: agregar `apscheduler==3.10.4`

## Tests (R11)

- [x] **T10** Ancla: campaña con evento `entrega` usa esa fecha; sin evento usa `created_at`
- [x] **T11** Anonimización: todos los campos R3 en NULL/tombstone; `status`, `provincia`, `confirmed_at` intactos; conteo de campaña no cambia
- [x] **T12** Idempotencia: segunda corrida no toca firmas ya anonimizadas
- [x] **T13** Auditoría: `retention_runs` registra conteos correctos, sin PII
- [x] **T14** Endpoint manual: 403 sin rol admin; 200 con resumen para admin

## Verificación local

- [x] **T15** Firma de prueba con `retention_days=0` → corrida manual vía HTTP con login real de admin → fila anonimizada, contador de landing de `prueba-001` intacto; campañas reales no tocadas
