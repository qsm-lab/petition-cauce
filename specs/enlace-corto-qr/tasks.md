# Tasks — enlace-corto-qr

## Backend

- [ ] **T1** Migración: `campaigns.short_code VARCHAR(12) UNIQUE` + backfill de campañas existentes (R1)
- [ ] **T2** `campaign_service`: generador de código (alfabeto sin ambiguos, 7 chars, reintento en colisión); asignar en create (R1, R4)
- [ ] **T3** `public_campaign.py`: `GET /v1/public/short/{code}` → `{slug, domain}`; 404 si no existe o archivada (R2, R3)
- [ ] **T4** Exponer `short_code` en la respuesta admin de campaña (R4)

## Frontend

- [ ] **T5** Route handler `app/s/[code]/route.ts`: resolve + redirect 302 con `?source=short`; 404 amigable (R2, R3)
- [ ] **T6** Editor admin — panel QR: mostrar enlace corto con botón copiar (R4)
- [ ] **T7** QR codifica `https://<dominio>/s/<code>?source=qr` (R5, R7)
- [ ] **T8** Botón "Descargar QR" PNG 1024px (R6)
- [ ] **T9** Verificar/propagar `?source=` de la URL al payload del formulario de firma (R8)

## Tests (R9)

- [ ] **T10** Unicidad + estabilidad del código (editar campaña no lo cambia)
- [ ] **T11** Redirect 302 con source; 404 código inexistente y campaña archivada
- [ ] **T12** Firma con `?source=qr` persiste `signatures.source == "qr"`

## Verificación local

- [ ] **T13** Crear campaña → copiar enlace corto → abre landing correcta; QR escaneado desde móvil llega a la landing
