# Tareas — lopdp-base
> Estado: spec_ready (pendiente aprobación)

---

## Migración

- [ ] **T1** — Crear `apps/api/migrations/versions/007_lopdp_base.py`
  - [ ] T1.1 — `ALTER TABLE privacy_config ADD COLUMN version SMALLINT NOT NULL DEFAULT 1` (R5)
  - [ ] T1.2 — `downgrade()`: `DROP COLUMN version`
  - [ ] T1.3 — Actualizar `apps/api/app/models/privacy_config.py`: añadir `version: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)`

## Módulo de retención

- [ ] **T2** — Crear `apps/api/app/legal/retention.py` (R12, R13)
  - [ ] T2.1 — Constantes `RETENTION_CAMPANA_CORTA`, `RETENTION_CAMPANA_ESTANDAR`, `RETENTION_CAMPANA_LARGA`
  - [ ] T2.2 — Función `retention_label(days: int) -> str`

## Plantillas Jinja2

- [ ] **T3** — Crear `apps/api/app/legal/templates/aviso_privacidad.jinja2` (R10)
  - [ ] T3.1 — Sección encabezado: título + número de versión + fecha de vigencia
  - [ ] T3.2 — Sección 1: Identidad del Responsable (org)
  - [ ] T3.3 — Sección 2: Identidad del Encargado (Cauce Petition, datos fijos)
  - [ ] T3.4 — Sección 3: Finalidad del tratamiento (campaign.title, campaign.authority)
  - [ ] T3.5 — Sección 4: Base de legitimación (Art. 7 LOPDP, consentimiento expreso)
  - [ ] T3.6 — Sección 5: Categorías de datos (bloque condicional según signer_type — `{% if %}`)
  - [ ] T3.7 — Sección 6: Plazo de conservación (retention_days + retention_label)
  - [ ] T3.8 — Sección 7: Derechos del titular (Art. 18–23 LOPDP)
  - [ ] T3.9 — Sección 8: Canal para ejercer derechos (data_contact_email)
  - [ ] T3.10 — Sección 9: Ausencia de transferencias internacionales
  - [ ] T3.11 — Pie: versión del aviso, fecha de vigencia

- [ ] **T4** — Crear `apps/api/app/legal/templates/contrato_encargo.jinja2` (R15)
  - [ ] T4.1 — Encabezado: título, partes, fecha
  - [ ] T4.2 — Cláusula 1: Objeto y naturaleza del encargo
  - [ ] T4.3 — Cláusula 2: Finalidad, categorías de datos y titulares (desde campaign_scope)
  - [ ] T4.4 — Cláusula 3: Duración (ligada a campaña + retention_days)
  - [ ] T4.5 — Cláusula 4: Instrucciones del Responsable al Encargado
  - [ ] T4.6 — Cláusula 5: Obligaciones del Encargado (Art. 26 lit. a–k LOPDP, listado completo)
  - [ ] T4.7 — Cláusula 6: Medidas de seguridad técnicas y organizativas (HMAC, RLS, cifrado, audit log)
  - [ ] T4.8 — Cláusula 7: Subencargos (prohibidos sin autorización escrita previa)
  - [ ] T4.9 — Cláusula 8: Asistencia al Responsable (derechos ARCO, RAT, brechas)
  - [ ] T4.10 — Cláusula 9: Terminación — destrucción o devolución de datos
  - [ ] T4.11 — Cláusula 10: Auditoría
  - [ ] T4.12 — Bloque de firmas: nombre, cargo, fecha, lugar, validation_token

- [ ] **T5** — Crear `apps/api/app/legal/templates/rat.jinja2` (R20, R21)
  - [ ] T5.1 — Encabezado: título, campaign_slug, fecha de generación
  - [ ] T5.2 — Sección 1: Identificación del Responsable
  - [ ] T5.3 — Sección 2: Identificación del Encargado
  - [ ] T5.4 — Sección 3: Finalidades del tratamiento
  - [ ] T5.5 — Sección 4: Categorías de titulares
  - [ ] T5.6 — Sección 5: Categorías de datos (+ indicación explícita: sin datos sensibles)
  - [ ] T5.7 — Sección 6: Destinatarios (campaign.authority + ningún tercero comercial)
  - [ ] T5.8 — Sección 7: Ausencia de transferencias internacionales
  - [ ] T5.9 — Sección 8: Plazos de conservación
  - [ ] T5.10 — Sección 9: Medidas de seguridad técnicas y organizativas
  - [ ] T5.11 — Sección 10: Versiones activas del aviso de privacidad (listado con fechas) (R21)
  - [ ] T5.12 — Pie: fecha de generación, versión del RAT

## Funciones Python

- [ ] **T6** — Crear `apps/api/app/legal/aviso_privacidad.py` (R4, R11)
  - [ ] T6.1 — `render_aviso_privacidad(context: dict) -> str` — carga y renderiza plantilla
  - [ ] T6.2 — `build_aviso_context(campaign, org, privacy_cfg) -> dict` — construye el contexto desde objetos SQLAlchemy

- [ ] **T7** — Crear `apps/api/app/legal/contrato_encargo.py` (R14, R18)
  - [ ] T7.1 — `render_contrato_encargo(context: dict) -> str`
  - [ ] T7.2 — `build_contrato_context(org, campaign_scope: dict) -> dict`
  - [ ] T7.3 — `get_contrato_dev() -> str` — RuntimeError si `settings.environment != "development"` (R18)

- [ ] **T8** — Crear `apps/api/app/legal/rat.py` (R19, R22)
  - [ ] T8.1 — `render_rat(context: dict) -> str`
  - [ ] T8.2 — `build_rat_context(campaign, org, privacy_cfg, aviso_versiones: list) -> dict`

- [ ] **T9** — Crear `apps/api/app/legal/__init__.py` (R29)
  - [ ] Exportar todas las funciones y constantes públicas

## Runbook operativo

- [ ] **T10** — Crear `docs/legal/runbook_brechas.md` (R23–R27)
  - [ ] T10.1 — Sección 1: Definición de brecha + criterios de notificación obligatoria a SPDP
  - [ ] T10.2 — Sección 2: Flujo con plazos (T+0, T+4h, T+24h, T+72h)
  - [ ] T10.3 — Sección 3: Plantilla notificación SPDP
  - [ ] T10.4 — Sección 4: Plantilla notificación al Responsable (org activista)
  - [ ] T10.5 — Sección 5: Plantilla notificación opcional a titulares
  - [ ] T10.6 — Sección 6: Datos mínimos requeridos por SPDP (R26)
  - [ ] T10.7 — Sección 7: Contactos SPDP, ARCOTEL, EcuCERT (R27)

## Integración con seed

- [ ] **T11** — Actualizar `apps/api/app/scripts/seed_dev.py`
  - [ ] T11.1 — Usar `get_contrato_dev()` para `processing_contracts.content_text`
  - [ ] T11.2 — Usar `render_aviso_privacidad(build_aviso_context(...))` para `privacy_config.aviso_privacidad`

## Verificación

- [ ] **T12** — `make migrate` aplica 007 sin errores; `alembic current` → `007 (head)`
- [ ] **T13** — `privacy_config.version` existe en la tabla y tiene valor `1` en la campaña dev
- [ ] **T14** — `render_aviso_privacidad` produce texto con las 10 secciones del Art. 13 LOPDP
- [ ] **T15** — `render_contrato_encargo` produce texto con las 10 cláusulas + bloque de firmas
- [ ] **T16** — `render_rat` produce texto con las 10 secciones + listado de versiones de aviso
- [ ] **T17** — `get_contrato_dev()` lanza `RuntimeError` si `settings.environment = "production"`
- [ ] **T18** — `make seed` usa textos legales reales (no placeholders) en `processing_contracts.content_text` y `privacy_config.aviso_privacidad`
