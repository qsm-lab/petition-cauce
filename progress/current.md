# Estado actual — tras sesión 12 (2026-07-02)

## Resumen de sesión 12

- `dashboard-firmas` implementado y verificado (T1-T28)
- `ui-design-system` verificaciones V1/V3/V4 completadas — feature completo
- UUID de campaña dev corregido en este archivo

---

## Corrección de datos dev

| Campo | Valor correcto |
|-------|----------------|
| Campaña dev ID | `90160ea0-8f05-4605-9fb5-e1af8cc5bf52` |
| URL firmas admin | `http://localhost:3002/admin/campanas/90160ea0-8f05-4605-9fb5-e1af8cc5bf52/firmas` |

---

## Estado de features

| Feature | Estado | Notas |
|---------|--------|-------|
| `harness-setup` | **done** | Completo |
| `infra-fork` | **in_progress** | Local completo; pendiente Cloudflare/VPS/Secrets + `RESEND_API_KEY` |
| `ui-design-system` | **done** | V1-V5 verificados; tokens inyectables por campaña ✓ |
| `modelo-base` | **done** | Migración 006 aplicada ✓ |
| `lopdp-base` | **done** | Completo ✓ |
| `multidominio` | **done** | Completo ✓ |
| `anti-fraude-basico` | **done** | Completo ✓ |
| `landing-campana` | **done** | Completo ✓ |
| `formulario-firma` | **done** | Submit/confirm/dedup + form_config + Resend ✓ |
| `dashboard-firmas` | **in_progress** | Implementado y verificado ✓ (usuario valida) |

---

## Credenciales de desarrollo

| Campo | Valor |
|-------|-------|
| Email | `admin@cauce.ec` |
| Password | `admin123dev` |
| URL admin | `http://localhost:3002/admin/resumen` |
| URL landing campaña | `http://localhost:3002/?slug=campana-dev-001` |
| Campaña dev ID | `90160ea0-8f05-4605-9fb5-e1af8cc5bf52` |

---

## Próxima sesión

### Al inicio (si es Mac nueva o hubo pull)

```bash
docker compose -f docker-compose.dev.yml up -d --build
docker exec petition-api-dev alembic upgrade head
```

### Tareas disponibles (orden sugerido)

1. **`infra-fork`** — Cloudflare DNS + GitHub Secrets + deploy VPS
   - Pasos ya documentados en la sesión 12 (ver `progress/history.md`)

2. **`editor-campana`** — formulario admin para crear/editar campañas
   - Requiere spec SDD antes de implementar

3. **`resumen-admin`** — KPIs reales en `/admin/resumen` (actualmente muestra ceros)
   - Requiere endpoint `GET /v1/admin/dashboard`

### Activación Resend en producción (VPS)

```bash
# Agregar a .env en VPS:
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@tudominio.ec
API_PUBLIC_URL=https://api.tudominio.ec
```
