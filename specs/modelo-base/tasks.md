# Tareas — modelo-base
> Estado: spec_ready (pendiente aprobación)

---

## Migración Alembic

- [ ] **T1** — Crear `006_modelo_base.py` con `down_revision = "005"` (R1–R29)
  - [ ] T1.1 — Extender `users`: `status`, `archived_at`, `archived_by` (R2)
  - [ ] T1.2 — Extender `users.role`: CHECK constraint con `admin`, `gestor`, `editor`; default → `gestor` (R1)
  - [ ] T1.3 — Extender `organizations`: `domain`, `rep_name`, `status`, `archived_at`, `archived_by` (R3)
  - [ ] T1.4 — Extender `campaigns`: `processing_contract_id NOT NULL`, `category`, `goal_count`, `authority`, `asks`, `petition_body`, `hero_image_url`, `lifecycle_stage`, `archived_at`, `archived_by` (R4, R5, R6)
  - [ ] T1.5 — Crear tabla `signatures` con CHECK constraints y UNIQUE constraints (R7–R13)
  - [ ] T1.6 — Habilitar RLS en `signatures` + 2 políticas (R13)
  - [ ] T1.7 — Crear tabla `consents` (R14, R15)
  - [ ] T1.8 — Habilitar RLS en `consents` (R16)
  - [ ] T1.9 — Crear tabla `privacy_config` (R17, R18)
  - [ ] T1.10 — Crear tabla `lifecycle_events` con CHECK constraint de stage (R19–R22)
  - [ ] T1.11 — Crear tabla `domains` (R23, R24)
  - [ ] T1.12 — Crear índices (R28)
  - [ ] T1.13 — Extender trigger `update_updated_at` a `signatures` y `privacy_config` (R29)
  - [ ] T1.14 — `downgrade()` completo y testeado

## Modelos SQLAlchemy

- [ ] **T2** — `apps/api/app/models/signature.py` — clase `Signature` con todas las columnas y relaciones
- [ ] **T3** — `apps/api/app/models/consent.py` — clase `Consent`
- [ ] **T4** — `apps/api/app/models/privacy_config.py` — clase `PrivacyConfig`
- [ ] **T5** — `apps/api/app/models/lifecycle_event.py` — clase `LifecycleEvent`
- [ ] **T6** — `apps/api/app/models/domain.py` — clase `Domain`
- [ ] **T7** — `apps/api/app/models/campaign.py` — añadir campos nuevos y relaciones a Signature, PrivacyConfig, LifecycleEvent, Domain
- [ ] **T8** — `apps/api/app/models/user.py` — añadir `status`, `archived_at`, `archived_by`
- [ ] **T9** — `apps/api/app/models/organization.py` — añadir `domain`, `rep_name`, `status`, `archived_at`, `archived_by`
- [ ] **T10** — `apps/api/app/models/__init__.py` — exportar todos los modelos nuevos

## Scripts de desarrollo

- [ ] **T11** — `seed_dev.py` — añadir `processing_contract_id = "CONTRATO-DEV-001"` a la campaña de prueba; añadir `privacy_config` de prueba; añadir 3 `lifecycle_events` de prueba (lanzada → recoleccion)

## Aplicar en dev

- [ ] **T12** — `docker exec petition-api-dev alembic upgrade head` — aplicar migración 006
- [ ] **T13** — Verificar con `\d signatures`, `\d consents` desde psql que las tablas y RLS existen
- [ ] **T14** — Verificar que `alembic current` muestra `006` como HEAD
- [ ] **T15** — Re-ejecutar `seed_dev.py` para datos de prueba actualizados
