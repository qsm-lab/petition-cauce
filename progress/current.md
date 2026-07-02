# Estado actual — sesión en curso 2026-07-02 (sesión 12)

## Resumen de sesión

Dashboard de firmas implementado (T1-T28). Migración 010 aplicada.
ui-design-system verificado: V1/V3/V4 PASS (fidelidad visual, fuentes locales, inyección tokens).

---

## Corrección de datos dev

| Campo | Valor correcto |
|-------|----------------|
| Campaña dev ID | `90160ea0-8f05-4605-9fb5-e1af8cc5bf52` (el de progress/current.md anterior era obsoleto) |
| URL firmas admin | `http://localhost:3002/admin/campanas/90160ea0-8f05-4605-9fb5-e1af8cc5bf52/firmas` |

---

## Estado de features

| Feature | Estado | Notas |
|---------|--------|-------|
| `harness-setup` | **done** | Completo |
| `infra-fork` | **in_progress** | Local completo; pendiente Cloudflare/VPS/Secrets + `RESEND_API_KEY` |
| `ui-design-system` | **verificado** | V1/V3/V4 PASS — fidelidad visual, fuentes locales, tokens inyectables |
| `modelo-base` | **done** | Migración 006 aplicada y verificada ✓ |
| `lopdp-base` | **done** | Implementación completa y verificada ✓ |
| `multidominio` | **done** | Implementado y funcionando ✓ |
| `anti-fraude-basico` | **done** | Implementado (RLS, dedup, rate-limit) ✓ |
| `landing-campana` | **done** | Next.js renderiza correctamente ✓ |
| `formulario-firma` | **done** | Submit/confirm/dedup + iteraciones UI + Resend ✓ |
| `dashboard-firmas` | **in_progress** | Implementado y verificado T19-T28 ✓ (usuario valida) |

---

## Lo completado esta sesión

### Iteraciones formulario de firma (UI)

| Cambio | Archivo |
|--------|---------|
| Toggle "Persona natural / Organización" (controlado por `form_config.signer_types`) | `StepForm.tsx` |
| Toggle "¿Firmas desde?" Ecuador / Internacional | `StepForm.tsx` |
| Campo `org_name` condicional | `StepForm.tsx` |
| Cédula movida DESPUÉS de provincia/país | `StepForm.tsx` |
| Internacional → "Número de identificación (opcional)", sin módulo-10, acepta cualquier formato | `StepForm.tsx` |
| Visibilidad filtrada por `form_config.visibility_options`; Secreta oculta por defecto | `StepForm.tsx` |
| Migración 010: columna `country` en `signatures` | `010_add_country_to_signatures.py` |
| Schema backend actualizado (`signer_type`, `org_name`, `country`, `location_mode`) | `schemas/signature.py` |
| Validación cédula solo cuando `location_mode == "nacional"` | `signature_service.py` |
| `form_config` expuesto en `GET /v1/public-campaign/{id}` | `public_campaign.py` |
| Seed dev con `form_config` completo (signer_types, location_modes, visibility_options, secreta) | `seed_dev.py` |
| `FormConfig` interface + `DEFAULT_FORM_CONFIG` en web | `campaign-api.ts` |
| `SignaturePayload` actualizado con todos los campos nuevos | `signatures-api.ts` |
| `CampaignPage` pasa `form_config` a `SignFlow` | `CampaignPage.tsx` |

### Integración Resend (email double opt-in)

| Cambio | Archivo |
|--------|---------|
| `email_service.py` — envía via Resend si `RESEND_API_KEY` configurado; log en consola en dev | NUEVO |
| `send_confirmation_email()` llamado en `create_signature()` después de commit | `signature_service.py` |
| `POST /{campaign_id}/signatures/resend-confirmation` — rate limit 3/min, siempre 204 | `public_campaign.py` |
| `resend_from_email` + `api_public_url` en config | `config.py` |
| `resendConfirmation()` en `signatures-api.ts` | `signatures-api.ts` |
| `StepSuccess` con estados idle/sending/sent en botón "Reenviar" | `StepSuccess.tsx`, `SignFlow.tsx` |

### Corrección Step 4 — contador real

- `getCampaignCount()` en `signatures-api.ts`
- `handleContinue()` en `SignFlow.tsx` fetchea el contador antes de ir a Step 4

### Specs generados

- `specs/dashboard-firmas/requirements.md` — R1-R28
- `specs/dashboard-firmas/design.md` — API + arquitectura frontend
- `specs/dashboard-firmas/tasks.md` — T1-T28

---

## Credenciales de desarrollo (activas)

| Campo | Valor |
|-------|-------|
| Email | `admin@cauce.ec` |
| Password | `admin123dev` |
| URL admin | `http://localhost:3002/admin/resumen` |
| URL landing campaña | `http://localhost:3002/?slug=campana-dev-001` |
| Campaña dev ID | `16431490-7875-4ce1-8e70-56eb6bba3dd8` |

---

## Pendiente de commit

```
apps/api/app/config.py
apps/api/app/main.py
apps/api/app/models/signature.py
apps/api/app/routers/public_campaign.py
apps/api/app/schemas/signature.py
apps/api/app/services/email_service.py  (nuevo)
apps/api/app/services/signature_service.py
apps/api/app/scripts/seed_dev.py
apps/api/migrations/versions/010_add_country_to_signatures.py  (nuevo)
apps/web/src/lib/campaign-api.ts
apps/web/src/lib/signatures-api.ts
apps/web/src/components/sign-flow/SignFlow.tsx
apps/web/src/components/sign-flow/StepForm.tsx
apps/web/src/components/sign-flow/StepSuccess.tsx
apps/web/src/app/(campaign)/CampaignPage.tsx
specs/dashboard-firmas/requirements.md
specs/dashboard-firmas/design.md
specs/dashboard-firmas/tasks.md
progress/current.md
progress/history.md
```

---

## Próxima sesión

### Activación Resend en producción

En VPS agregar a `.env`:
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@tudominio.ec
API_PUBLIC_URL=https://api.tudominio.ec
```

### Tareas disponibles (orden sugerido)

1. **`dashboard-firmas`** — implementar panel admin (specs T1-T28 aprobados)
   - API: `GET /v1/admin/campaigns/{id}/signatures` + `/export.csv`
   - Frontend: tabla + paginación + filtros + export

2. **`infra-fork`** — Cloudflare DNS + GitHub Secrets + deploy VPS

3. **`ui-design-system`** — vistas V1/V3/V4 pendientes
