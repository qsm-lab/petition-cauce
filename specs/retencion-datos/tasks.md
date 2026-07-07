# Tasks — retencion-datos

## Migración y modelos

- [ ] **T1** Migración `016_retention.py`: columna `signatures.anonymized_at` + tabla `retention_runs` (R3, R6)
- [ ] **T2** Modelo `RetentionRun` + columna en modelo `Signature`

## Servicio

- [ ] **T3** `retention_service.compute_expiry(campaign, privacy_config, signature)` — ancla evento `entrega` o `created_at` (R2)
- [ ] **T4** `retention_service.anonymize_signature(sig)` — campos a NULL/tombstone según design (R3, R4)
- [ ] **T5** `retention_service.run_retention(db, trigger)` — evalúa campañas, lotes de 500, excluye `anonymized_at IS NOT NULL`, anonimiza `consents.ip_hmac`, registra `RetentionRun` (R1, R5, R6, R7)

## Scheduler y endpoint

- [ ] **T6** `scheduler.py`: AsyncIOScheduler, corrida diaria 03:00 Guayaquil, lock Redis `petition:retention:lock` SET NX TTL 1h (R1, R8)
- [ ] **T7** `main.py`: integrar scheduler en lifespan (start/shutdown limpio)
- [ ] **T8** `admin_retention.py`: `POST /v1/admin/retention/run` — JWT admin, responde resumen de la corrida (R9)
- [ ] **T9** `requirements.txt`: agregar `apscheduler`

## Tests (R11)

- [ ] **T10** Ancla: campaña con evento `entrega` usa esa fecha; sin evento usa `created_at`
- [ ] **T11** Anonimización: todos los campos R3 en NULL/tombstone; `status`, `provincia`, `confirmed_at` intactos; conteo de campaña no cambia
- [ ] **T12** Idempotencia: segunda corrida no toca firmas ya anonimizadas
- [ ] **T13** Auditoría: `retention_runs` registra conteos correctos, sin PII
- [ ] **T14** Endpoint manual: 403 sin rol admin; 200 con resumen para admin

## Verificación local

- [ ] **T15** Firma de prueba con `retention_days=0` → corrida manual → fila anonimizada, contador de landing intacto
