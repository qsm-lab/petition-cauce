# Estado actual — cierre sesión 2026-06-30 (sesión 8)

## Resumen de sesión

- Feature `lopdp-base` implementada completa (T1–T18)
- Migración 007 aplicada: columna `version` en `privacy_config`
- Templates Jinja2: aviso_privacidad, contrato_encargo, RAT
- Funciones Python: render + build_context para los 3 documentos + `get_contrato_dev()`
- Runbook de brechas: `docs/legal/runbook_brechas.md` (protocolo 72h SPDP)
- `seed_dev.py` actualizado: contrato usa `get_contrato_dev()`, privacy_config usa `render_aviso_privacidad()`
- `.env.example` actualizado con vars `ENCARGADO_*` y `RESEND_API_KEY`
- Seed verificado: exitoso en Mac 2 (~/Dev/proy_petition-cauce)

---

## Estado de features

| Feature | Estado | Notas |
|---------|--------|-------|
| `harness-setup` | **done** | Completo |
| `infra-fork` | **in_progress** | Local completo; pendiente Cloudflare/VPS/Secrets |
| `ui-design-system` | **in_progress** | Shell admin incorporado; V1/V3/V4 pendientes |
| `modelo-base` | **in_progress** | Migración 006 aplicada y verificada; commit pendiente |
| `lopdp-base` | **in_progress** | Implementación completa; commit pendiente |
| Fase 1–5 (27 features) | pending | Después de Fase 0 |

---

## Lo completado esta sesión

### Feature `lopdp-base` (T1–T18)

| Archivo | Descripción |
|---------|-------------|
| `migrations/versions/007_lopdp_base.py` | Columna `version` en `privacy_config` |
| `app/legal/retention.py` | Constantes de retención + `retention_label()` |
| `app/legal/templates/aviso_privacidad.jinja2` | Aviso de privacidad 9 secciones, condicional natural/juridica y signer_type |
| `app/legal/templates/contrato_encargo.jinja2` | Contrato encargo 12 cláusulas + bloque firmas con validation_token |
| `app/legal/templates/rat.jinja2` | RAT 10 secciones + loop versiones activas del aviso |
| `app/legal/aviso_privacidad.py` | `render_aviso_privacidad()` + `build_aviso_context()` |
| `app/legal/contrato_encargo.py` | `render_contrato_encargo()` + `build_contrato_context()` + `get_contrato_dev()` |
| `app/legal/rat.py` | `render_rat()` + `build_rat_context()` |
| `app/legal/__init__.py` | Exports de todos los módulos |
| `docs/legal/runbook_brechas.md` | Runbook brechas: cronograma T+0 a T+72h, contenido SPDP, registro interno |
| `app/scripts/seed_dev.py` | Usa `get_contrato_dev()` y `render_aviso_privacidad()` |
| `app/config.py` | Vars encargado (`encargado_tipo/nombre/cedula_ruc/rep_nombre/domicilio/email`) + `resend_api_key` |
| `requirements.txt` | `jinja2==3.1.4` |
| `.env.example` | Sección `ENCARGADO_*` y `RESEND_API_KEY` |
| `app/models/privacy_config.py` | Campo `version: Mapped[int]` |

### Verificaciones

- `make migrate` → migración 007 aplicada ✓
- `make seed` → exitoso, aviso real generado por Jinja2, contrato completo ✓

---

## Archivos pendientes de commit

### modelo-base
```
apps/api/migrations/versions/006_modelo_base.py
apps/api/app/models/processing_contract.py
apps/api/app/models/signature.py
apps/api/app/models/consent.py
apps/api/app/models/privacy_config.py
apps/api/app/models/lifecycle_event.py
apps/api/app/models/domain.py
apps/api/app/models/__init__.py
apps/api/app/models/campaign.py
apps/api/app/models/organization.py
apps/api/app/models/user.py
apps/api/app/crypto.py
```

### lopdp-base
```
apps/api/migrations/versions/007_lopdp_base.py
apps/api/requirements.txt
apps/api/app/config.py
apps/api/app/scripts/seed_dev.py
apps/api/app/legal/__init__.py
apps/api/app/legal/retention.py
apps/api/app/legal/aviso_privacidad.py
apps/api/app/legal/contrato_encargo.py
apps/api/app/legal/rat.py
apps/api/app/legal/templates/aviso_privacidad.jinja2
apps/api/app/legal/templates/contrato_encargo.jinja2
apps/api/app/legal/templates/rat.jinja2
docs/legal/runbook_brechas.md
.env.example
progress/current.md
progress/history.md
```

---

## Credenciales de desarrollo (activas)

| Campo | Valor |
|-------|-------|
| Email | `admin@cauce.ec` |
| Password | `admin123dev` |
| URL admin | `http://localhost:3002/admin/resumen` |
| Campaña dev | `campana-dev-001` (signer_type=both, lifecycle_stage=1) |
| Contrato dev | `CONTRATO-DEV-001` (firmado, texto completo Jinja2) |

## Directorio de trabajo (Mac 2)

```
~/Dev/proy_petition-cauce/
```

---

## Próxima sesión — Fase 1 MVP

1. **`landing-campana`** — página pública de campaña (requiere diseño Claude Design)
2. **`formulario-firma`** — formulario de firma (PII, requiere privacy_config aprobada)
3. **`multidominio`** — routing por dominio para campañas
4. **`infra-fork`** — Cloudflare DNS + GitHub Secrets + VPS deploy (cuando toque)
