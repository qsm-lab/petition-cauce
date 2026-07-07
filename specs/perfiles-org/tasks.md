# Tasks — perfiles-org

> **Spec retroactiva** (sesión 24). T1-T9 se implementaron en sesiones 18-19.

## Implementado

- [x] **T1** Modelo `Organization` con slug único, status, soft delete (R2, R5)
- [x] **T2** Modelo `Category` con unicidad `(slug, org_id)` y partial unique index (R8)
- [x] **T3** Router `organizaciones.py`: list con conteo de campañas activas, create con 409 en slug duplicado, get, patch (R1-R4, R7)
- [x] **T4** Archive de organización con 409 si tiene campañas activas (R5)
- [x] **T5** Endpoint campañas por organización, excluye archivadas (R6)
- [x] **T6** Router categorías: CRUD con trim de nombre y 409 en duplicado (R8)
- [x] **T7** Página admin listado/creación de organizaciones (R9)
- [x] **T8** Página admin detalle de organización: perfil, campañas, categorías inline (R9)
- [x] **T9** Página admin de categorías globales (R8)

## Pendiente

- [ ] **T10** Taxonomía de regiones para campañas (R10) — requiere diseño
- [ ] **T11** Catálogo público multi-org filtrable por tema/región (R11) — requiere diseño + Claude Design (frontend)
