# Design — perfiles-org

> **Spec retroactiva** (sesión 24). Documenta lo implementado en sesiones 18-19.

## Archivos afectados (implementados)

### Backend
- `apps/api/app/models/organization.py` — modelo con `slug` único, `status`, `domains` JSONB, `settings` JSONB, soft delete (`archived_at`, `archived_by`)
- `apps/api/app/models/category.py` — taxonomía con `UniqueConstraint(slug, org_id)` + partial unique index (migración de sesión 20)
- `apps/api/app/routers/organizaciones.py` — CRUD + archive + campañas por org, guard rol `admin`
- `apps/api/app/routers/categories.py` — CRUD categorías con trim y 409 en duplicado
- `apps/api/app/schemas/organization.py` — `OrganizationCreate/Update/Response`
- `apps/api/app/services/organization_service.py` — lógica de listado con conteo de campañas activas, archive con validación

### Frontend
- `apps/web/src/app/admin/organizaciones/page.tsx` + `OrganizacionesClient.tsx` — listado y creación
- `apps/web/src/app/admin/organizaciones/[id]/page.tsx` + `OrgDetailClient.tsx` — perfil, campañas, categorías inline
- `apps/web/src/app/admin/categorias/page.tsx` + `CategoriasList.tsx` — gestión global de categorías

## Decisiones

- **Soft delete** en organizaciones y categorías (`archived_at`) — consistente con el patrón de campañas.
- Archive de organización bloqueado (`409`) si tiene campañas activas — evita huérfanos.
- Categorías con `org_id` nullable: categorías globales (plataforma) y por organización conviven; unicidad `(slug, org_id)` con partial unique index para las globales.
- `domains` JSONB en organización reservado para multidominio por org (no usado aún).

## Seguridad

- Todas las rutas requieren JWT (`get_current_user`) + rol `admin` para escritura/listado.
- `get_db_with_org` aplica el contexto RLS heredado de forms-qsm.

## LOPDP

- La organización es el **Responsable** del tratamiento; la plataforma es Encargado.
- `contact_email` y `rep_name` son datos de contacto institucional, no PII de firmantes — sin requisitos de cifrado especiales.
- El vínculo campaña→organización sostiene la trazabilidad del contrato de encargo (`processing_contract_id` en campaigns).

## Alcance restante (R10, R11)

- Taxonomía de regiones: pendiente de diseño — probable tabla `regions` estática (provincias EC) o enum en meta.
- Catálogo público multi-org: pendiente — nueva ruta pública, sin JWT, solo campañas activas y datos no sensibles.
