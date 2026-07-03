# Tasks — firma-visibilidad (retroactivo)

- [x] **T1** Opciones de visibilidad en `StepForm.tsx` filtradas por `form_config.visibility_options` (R1)
- [x] **T2** Default a `anonima` si disponible, si no primer valor de `visibility_options` (R2)
- [x] **T3** `create_signature`: almacena `name=null` si `visibility != 'publica'` (R3)
- [x] **T4** `get_recent_signatures`: filtra `WHERE visibility='publica' AND status='confirmed'` (R4)
- [x] **T5** Counter total: cuenta todos los `confirmed` sin filtro de visibilidad (R5)
- [x] **T6** Dashboard admin: tabla con badges de visibilidad y filtro por visibilidad (R6)
- [x] **T7** RLS `sig_public`: restringe SELECT público a `(publica, anonima)` cuando `app.current_org_id` IS NULL (R7)
