# Design — editor-campana

## Archivos afectados

### Backend
| Archivo | Cambio |
|---------|--------|
| `apps/api/app/services/campaign_service.py` | Fix `list_campaigns`: usar `Campaign.org_id == org_id` (sin join Form). Fix `get_campaign`: idem. Fix `create_campaign`: asignar `org_id=user.org_id`. Fix `list_with_counts`: usar `Signature` en lugar de `Response`, filtrar por `Campaign.org_id`. Nuevo método `get_signature_count(campaign_id)`. |
| `apps/api/app/schemas/campaign.py` | Extender `CampaignCreate` con: `goal_count`, `authority`, `category`, `petition_body`, `hero_image_url`. Extender `CampaignUpdate` con los mismos. Extender `CampaignResponse` con: `goal_count`, `authority`, `category`, `petition_body`, `hero_image_url`, `slug`. |
| `apps/api/app/routers/campaigns.py` | Fix `_get_owned_campaign`: usar `Campaign.org_id` directamente. Agregar manejo de 409 en `create_campaign` para slug duplicado. |

### Frontend
| Archivo | Cambio |
|---------|--------|
| `apps/web/src/app/admin/campanas/page.tsx` | Convertir a Server Component async. Fetch `GET /v1/campaigns` con cookie. Renderizar tabla con datos reales. Activar botón "Nueva campaña" → `/admin/campanas/nueva`. |
| `apps/web/src/app/admin/campanas/nueva/page.tsx` | **Nuevo.** Formulario de creación (Client Component con `use client`). POST a `/v1/campaigns`. Redirect a `/admin/campanas/[id]` al crear. |
| `apps/web/src/app/admin/campanas/[id]/page.tsx` | **Nuevo.** Formulario de edición. Fetch `GET /v1/campaigns/[id]`. PUT/PATCH a los endpoints correspondientes. Links a firmas y landing pública. |

## Decisiones

- **Sin `form_id` obligatorio.** Las campañas de petition-cauce son independientes de formularios. `form_id` queda opcional (null por default). No se modifica la tabla; el modelo ya lo tiene nullable.
- **`petition_body` como JSONB.** Para MVP: `{ "paragraphs": ["texto..."] }`. Permite evolucionar a rich text sin migración.
- **Estado inicial:** `draft`. El admin lo cambia a `active` manualmente.
- **Filtro org_id en service, no en router.** El router pasa `current_user.org_id`; el service hace el WHERE. Consistente con `admin_signatures.py`.
- **Slug: validar en DB.** El campo tiene `unique=True` en el modelo. Al recibir IntegrityError por slug duplicado, el router devuelve HTTP 409.
- **No hay diseño Claude Design para esta pantalla.** La UI sigue el Design System existente (tokens CSS + Tailwind). Los layouts heredan el patrón de `/admin/campanas/[id]/firmas/`.

## Seguridad
- Todos los endpoints requieren JWT válido (cookie `access_token`).
- `org_id` viene del token JWT, no del body del request — el cliente no puede falsificarlo.
- No hay PII en esta feature (solo metadatos de campaña).

## No incluido en esta spec
- Subida de `hero_image_url` (solo URL manual en MVP).
- Editor rich text para `petition_body` (textarea plano en MVP).
- Eliminación de campañas (se archiva en una fase posterior).
