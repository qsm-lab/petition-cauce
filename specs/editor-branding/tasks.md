# Tasks — editor-branding

---

## Backend

- [ ] **T1** `schemas/campaign.py` — agregar `branding: dict = {}` a `CampaignUpdate`
- [ ] **T2** `schemas/campaign.py` — agregar `"branding"` a `_META_FIELDS`
- [ ] **T3** Verificar que `welcome_title`, `welcome_slogan`, `welcome_description`, `welcome_logo_url`, `thank_you_title`, `thank_you_body`, `social_links` ya llegan en `AdminCampaignDetailResponse` (sin cambio si están en `CampaignResponse`)

## Frontend — componente de color

- [ ] **T4** Crear `BrandingColorPicker.tsx` — 3 chips preset (Bosque/Océano/Fuego) + `<input type="color">` + campo texto hex + función `autoOnPrimary()`

## Frontend — sección en editor (portar desde forms-qsm + adaptar)

- [ ] **T5** Agregar estado inicial para campos de branding en `CampanaEditorClient`: `primaryColor`, `welcomeLogoUrl`, `welcomeTitle`, `welcomeSlogan`, `welcomeDescription`, `welcomeTitleColor`, `welcomeSloganColor`, `thankYouTitle`, `thankYouBody`, `socialLinks`
- [ ] **T6** Nueva sección "Identidad visual" en el formulario principal: integrar `BrandingColorPicker` + campos welcome + miniatura de logo
- [ ] **T7** Nueva sección "Agradecimiento" (colapsable o separada): `thank_you_title` + `thank_you_body`
- [ ] **T8** Nueva sección "Redes sociales": 6 campos URL (instagram, facebook, tiktok, whatsapp, newsletter, website)
- [ ] **T9** Opciones avanzadas (`<details>`): `welcome_title_size`, `welcome_slogan_size`, `welcome_title_color`, `welcome_slogan_color`
- [ ] **T10** Incluir todos los campos de branding en `buildPayload()` del submit del editor

## Verificación

- [ ] **T11** Guardar campaña con color Fuego `#E63946` → abrir landing → verificar botón CTA rojo
- [ ] **T12** Guardar con preset Bosque → landing vuelve a Lime `#D7F24C`
- [ ] **T13** URL de logo válida → miniatura visible en editor; vacío → sin error
- [ ] **T14** Social links guardados → aparecen en `StepThanks` de la landing
- [ ] **T15** TypeScript: 0 errores
