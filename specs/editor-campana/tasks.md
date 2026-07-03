# Tasks — editor-campana

## Backend

- [ ] **T1** Fix `CampaignService.list_campaigns`: usar `Campaign.org_id == org_id` sin join a Form (R5)
- [ ] **T2** Fix `CampaignService.get_campaign`: usar `Campaign.org_id == org_id` sin join a Form (R5)
- [ ] **T3** Fix `CampaignService.create_campaign`: asignar `org_id=user.org_id` (R6)
- [ ] **T4** Fix `CampaignService.list_with_counts`: usar `Signature` (status=confirmed) en lugar de `Response`, filtrar por `Campaign.org_id` (R8)
- [ ] **T5** Extender `CampaignCreate` schema: agregar `goal_count`, `authority`, `category`, `petition_body`, `hero_image_url` (R1)
- [ ] **T6** Extender `CampaignUpdate` schema: agregar los mismos campos (R3)
- [ ] **T7** Extender `CampaignResponse` schema: agregar `goal_count`, `authority`, `category`, `petition_body`, `hero_image_url`, `slug` (R2, R3)
- [ ] **T8** Fix `campaigns.router._get_owned_campaign`: usar `Campaign.org_id` directamente (R5)
- [ ] **T9** Capturar `IntegrityError` en `create_campaign` y `update_campaign` y devolver HTTP 409 cuando el slug ya existe (R7)

## Frontend

- [ ] **T10** Convertir `/admin/campanas/page.tsx` a Server Component: fetch `GET /v1/campaigns` con cookie, renderizar tabla con datos reales (R2)
- [ ] **T11** Crear `/admin/campanas/nueva/page.tsx`: formulario de creación con campos de R1, POST a `/v1/campaigns`, redirect a `/admin/campanas/[id]` (R1)
- [ ] **T12** Crear `/admin/campanas/[id]/page.tsx`: fetch campaña, formulario de edición con campos de R3, PATCH/PUT endpoints correspondientes (R3, R4)
- [ ] **T13** En `/admin/campanas/[id]/page.tsx`: selector de estado con botón de cambio (R4)
- [ ] **T14** En `/admin/campanas/[id]/page.tsx`: links a `/admin/campanas/[id]/firmas` y a `/?slug=[slug]` (R9)
- [ ] **T15** Activar botón "Nueva campaña" en la lista (R1, R10)
