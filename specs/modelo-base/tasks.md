# Tareas — modelo-base
> Estado: spec_ready (pendiente aprobación final)

---

## Migración Alembic `006_modelo_base.py`

- [ ] **T1** — Crear `006_modelo_base.py` con `down_revision = "005"`
  - [ ] T1.1 — Crear tabla `processing_contracts` + trigger de inmutabilidad (R1–R3)
  - [ ] T1.2 — Extender `users`: `status`, `archived_at`, `archived_by`, CHECK en `role` (R4, R5)
  - [ ] T1.3 — Extender `organizations`: `domain`, `rep_name`, `status`, `archived_at`, `archived_by` (R6)
  - [ ] T1.4 — Extender `campaigns`: `processing_contract_id FK`, `signer_type`, campos de petición, `archived_at` (R7–R10)
  - [ ] T1.5 — Crear tabla `signatures` con CHECK constraints (R11, R12)
  - [ ] T1.6 — Crear 4 índices únicos parciales en `signatures` (R13)
  - [ ] T1.7 — Habilitar RLS en `signatures` + 2 políticas (R16)
  - [ ] T1.8 — Crear tabla `consents` + RLS (R17–R19)
  - [ ] T1.9 — Crear tabla `privacy_config` (R20, R21)
  - [ ] T1.10 — Crear tabla `lifecycle_events` con CHECK de stage (R22, R23)
  - [ ] T1.11 — Crear tabla `domains` (R25)
  - [ ] T1.12 — Crear índices (R29)
  - [ ] T1.13 — Extender trigger `update_updated_at` (R30)
  - [ ] T1.14 — `downgrade()` completo y reversible

## Modelos SQLAlchemy

- [ ] **T2** — `models/processing_contract.py` — `ProcessingContract`
- [ ] **T3** — `models/signature.py` — `Signature` con todos los campos y relaciones
- [ ] **T4** — `models/consent.py` — `Consent`
- [ ] **T5** — `models/privacy_config.py` — `PrivacyConfig`
- [ ] **T6** — `models/lifecycle_event.py` — `LifecycleEvent`
- [ ] **T7** — `models/domain.py` — `Domain`
- [ ] **T8** — `models/campaign.py` — añadir `signer_type`, `processing_contract_id`, `lifecycle_stage`, relaciones nuevas
- [ ] **T9** — `models/user.py` — añadir `status`, `archived_at`, `archived_by`
- [ ] **T10** — `models/organization.py` — añadir campos nuevos
- [ ] **T11** — `models/__init__.py` — exportar todos los modelos nuevos

## Utilidades

- [ ] **T12** — Verificar que `apps/api/app/crypto.py` expone `hmac_sha256(value, key)` y `verify_cedula(cedula)` (o crearlo si no existe)

## Scripts de desarrollo

- [ ] **T13** — `seed_dev.py` — añadir contrato de prueba (`CONTRATO-DEV-001`), `privacy_config` de prueba, 2 `lifecycle_events` (lanzada → recoleccion), campaña con `processing_contract_id` y `signer_type = 'both'`

## Aplicar en dev

- [ ] **T14** — `docker exec petition-api-dev alembic upgrade head`
- [ ] **T15** — Verificar tablas con `\d signatures`, `\d processing_contracts`, `\d+ signatures` (RLS ON)
- [ ] **T16** — Verificar índices parciales con `\di signatures*`
- [ ] **T17** — `alembic current` muestra `006`
- [ ] **T18** — Re-ejecutar `seed_dev.py`
