# Tasks — editor-branding

---

## Backend

- [x] **T1** `schemas/campaign.py` — agregar `branding: dict = {}` a `CampaignUpdate`
- [x] **T2** `schemas/campaign.py` — agregar `"branding"` a `_META_FIELDS`
- [x] **T3** Verificar que `welcome_title`, `welcome_slogan`, `welcome_description`, `welcome_logo_url`, `thank_you_title`, `thank_you_body`, `social_links` ya llegan en `AdminCampaignDetailResponse` (sin cambio si están en `CampaignResponse`)

## Frontend — componente de color

- [x] **T4** Crear `BrandingColorPicker.tsx` — 3 chips preset (Bosque/Océano/Fuego) + `<input type="color">` + campo texto hex + función `autoOnPrimary()`

## Frontend — sección en editor (portar desde forms-qsm + adaptar)

- [x] **T5** Agregar estado inicial para campos de branding en `CampanaEditorClient`: `primaryColor`, `welcomeLogoUrl`, `welcomeTitle`, `welcomeSlogan`, `welcomeDescription`, `welcomeTitleColor`, `welcomeSloganColor`, `thankYouTitle`, `thankYouBody`, `socialLinks`
- [x] **T6** Nueva sección "Identidad visual" en el formulario principal: integrar `BrandingColorPicker` + campos welcome + miniatura de logo
- [x] **T7** Nueva sección "Agradecimiento" (colapsable o separada): `thank_you_title` + `thank_you_body`
- [x] **T8** Nueva sección "Redes sociales": 6 campos URL (instagram, facebook, tiktok, whatsapp, newsletter, website)
- [x] **T9** Opciones avanzadas (`<details>`): `welcome_title_size`, `welcome_slogan_size`, `welcome_title_color`, `welcome_slogan_color`
- [x] **T10** Incluir todos los campos de branding en `buildPayload()` del submit del editor

## Verificación

- [x] **T11** Guardar campaña con color Fuego `#E63946` → abrir landing → verificar botón CTA rojo
- [x] **T12** Guardar con preset Bosque → landing vuelve a Lime `#D7F24C`
- [x] ~~**T13** URL de logo válida → miniatura visible en editor; vacío → sin error~~ — obsoleta: campo "Logo de la campaña" eliminado del editor en sesión 24 (`welcome_logo_url` no se usa en la landing; el único logo visible es el de la organización)
- [ ] **T14** Social links guardados → aparecen en `StepThanks` de la landing
- [x] **T15** TypeScript: 0 errores
