# Estado actual — cierre sesión 2026-06-30 (sesión 9)

## Resumen de sesión

Fase 1 MVP implementada y funcionando end-to-end. Se resolvieron 5 bugs bloqueantes tras la implementación de la sesión anterior.

---

## Estado de features

| Feature | Estado | Notas |
|---------|--------|-------|
| `harness-setup` | **done** | Completo |
| `infra-fork` | **in_progress** | Local completo; pendiente Cloudflare/VPS/Secrets |
| `ui-design-system` | **in_progress** | Shell admin incorporado; V1/V3/V4 pendientes |
| `modelo-base` | **in_progress** | Migración 006 aplicada y verificada; commit pendiente |
| `lopdp-base` | **in_progress** | Implementación completa; commit pendiente |
| `multidominio` | **in_progress** | Implementado y funcionando; commit pendiente |
| `anti-fraude-basico` | **in_progress** | Implementado (RLS, dedup, rate-limit); commit pendiente |
| `landing-campana` | **in_progress** | Next.js renderiza correctamente; commit pendiente |
| `formulario-firma` | **in_progress** | Submit/confirm/dedup OK; commit pendiente |

---

## Lo completado esta sesión

### Bugs corregidos

| Bug | Solución |
|-----|----------|
| Campaign status `draft` bloqueada por RLS `campaigns_public_read` | Seed actualizado a `status='active'`; DB actualizada |
| `API_INTERNAL_URL=http://petition-api:8000` no resolvía (contenedor se llama `petition-api-dev`) | Alias de red `petition-api` añadido en `docker-compose.dev.yml` |
| Turnstile bypass no funcionaba (`.env.dev` tiene key con un `A` menos que el `TEST_SECRET`) | `turnstile_service.py` usa `startswith(_TEST_PREFIX)` en vez de `==` |
| `sig_org_admin` RLS fallaba con `invalid input syntax for type uuid: ""` | Migración 008: `NULLIF` en ambas políticas; `sig_public` usa `confirmed` (English) y limitada a SELECT |
| `confirm_signature` fallaba por `status='confirmada'` (constraint dice `confirmed`) | Migración 009: política UPDATE para confirm flow; `signature_service.py` usa `confirmed` |

### Archivos nuevos / modificados (Fase 1)

**API:**
- `apps/api/app/schemas/signature.py` — SignatureCreate, validación visibilidad, cedula
- `apps/api/app/services/domain_service.py` — resuelve dominio → campaign_id, caché Redis
- `apps/api/app/services/signature_service.py` — create/confirm/recent/count; status `confirmed`
- `apps/api/app/services/turnstile_service.py` — bypass dev con prefijo de key
- `apps/api/app/routers/domains.py` — GET /v1/domains/resolve-domain
- `apps/api/app/routers/public_campaign.py` — GET by-slug, GET/POST signatures, confirm
- `apps/api/app/main.py` — registra los 2 nuevos routers
- `apps/api/app/scripts/seed_dev.py` — campaña en status `active`
- `apps/api/migrations/versions/008_fix_signatures_rls.py` — fix RLS sig_org_admin + sig_public
- `apps/api/migrations/versions/009_signatures_confirm_update_policy.py` — UPDATE policy para confirm

**Next.js:**
- `apps/web/src/lib/campaign-api.ts` — server-side API helpers
- `apps/web/src/lib/signatures-api.ts` — client-side submit/confirm
- `apps/web/src/app/page.tsx` — Server Component, resuelve campaña por slug/dominio
- `apps/web/src/app/aviso-de-privacidad/page.tsx` — muestra aviso de privacidad
- `apps/web/src/middleware.ts` — pasa x-original-host, sin redirect en "/"
- `apps/web/src/app/(campaign)/CampaignPage.tsx` — layout 1 col mobile / 2 col desktop
- `apps/web/src/app/(campaign)/components/` — Hero, ActionBlock, LifecycleSteps, PetitionBody, RecentSignatures, ShareSection, RegionBars, OrgCard
- `apps/web/src/components/sign-flow/` — SignFlow, StepForm, StepSending, StepSuccess, StepError, StepThanks

**Infra:**
- `docker-compose.dev.yml` — alias de red `petition-api` para el servicio `petition-api-dev`

### Verificaciones

- `GET /v1/public-campaign/by-slug/campana-dev-001` → 200 con datos completos ✓
- `POST /v1/public-campaign/{id}/signatures` → 201 primera vez, 409 duplicado, 422 cédula inválida ✓
- `GET /v1/public-campaign/confirm/{token}` → `{"count":1,"goal":10000}` ✓
- `GET /v1/public-campaign/{id}/signatures/recent` → `[{"name_display":"Juan Pérez",...}]` ✓
- `GET http://localhost:3002/?slug=campana-dev-001` → 200, título "Campaña de Prueba — Cauce Dev" ✓

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
```

### Fase 1 — multidominio, anti-fraude-basico, landing-campana, formulario-firma
```
docker-compose.dev.yml
apps/api/app/schemas/signature.py
apps/api/app/services/domain_service.py
apps/api/app/services/signature_service.py
apps/api/app/services/turnstile_service.py
apps/api/app/routers/domains.py
apps/api/app/routers/public_campaign.py
apps/api/app/main.py
apps/api/app/scripts/seed_dev.py
apps/api/migrations/versions/008_fix_signatures_rls.py
apps/api/migrations/versions/009_signatures_confirm_update_policy.py
apps/web/src/lib/campaign-api.ts
apps/web/src/lib/signatures-api.ts
apps/web/src/lib/design-tokens.ts
apps/web/src/app/page.tsx
apps/web/src/app/aviso-de-privacidad/page.tsx
apps/web/src/middleware.ts
apps/web/src/app/(campaign)/CampaignPage.tsx
apps/web/src/app/(campaign)/components/
apps/web/src/components/sign-flow/
specs/multidominio/
specs/anti-fraude-basico/
specs/landing-campana/
specs/formulario-firma/
```

---

## Credenciales de desarrollo (activas)

| Campo | Valor |
|-------|-------|
| Email | `admin@cauce.ec` |
| Password | `admin123dev` |
| URL admin | `http://localhost:3002/admin/resumen` |
| URL landing campaña | `http://localhost:3002/?slug=campana-dev-001` |
| Campaña dev | `campana-dev-001` (status=active, lifecycle_stage=1) |
| Contrato dev | `CONTRATO-DEV-001` (firmado, texto completo Jinja2) |

## Directorio de trabajo (Mac 2)

```
~/Dev/proy_petition-cauce/
```

---

## Próxima sesión

- Revisar visualmente la landing en browser (http://localhost:3002/?slug=campana-dev-001)
- Testear el Sign Flow completo en browser (abrir modal, llenar form, enviar)
- `dashboard-firmas` — spec y/o implementación (si el usuario lo aprueba)
- `infra-fork` — Cloudflare DNS + GitHub Secrets + deploy VPS
- Commits de Fase 1 cuando el usuario lo indique
