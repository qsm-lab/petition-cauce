# Tasks — resumen-admin

## Backend

- [x] **T1** Agregar método `CampaignService.get_dashboard_summary(db, org_id)` que retorna: `total_confirmed_signatures`, `active_campaigns`, `draft_campaigns`, `total_goal`, `recent_campaigns` (R3, R4)
- [x] **T2** Reescribir `dashboard_summary` en `dashboard.py` para llamar a `CampaignService.get_dashboard_summary` (R3)

## Frontend

- [x] **T3** Convertir `/admin/resumen/page.tsx` a Server Component async: fetch `GET /v1/dashboard/summary` con cookie forwarding (R5)
- [x] **T4** Mostrar KPIs reales: total_confirmed_signatures, active_campaigns, draft_campaigns, total_goal (R1)
- [x] **T5** Mostrar sección "Campañas recientes" con datos reales de `recent_campaigns` (R2)
- [ ] **T6** Manejo de error: si fetch falla mostrar "—" en KPIs y tabla vacía, sin crashear (R6)
- [ ] **T7** Reemplazar sección "Actividad reciente" con accesos rápidos: "Ver firmas" de primera campaña activa y "Nueva campaña" (R7)
