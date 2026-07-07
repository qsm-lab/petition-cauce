# Requirements — perfiles-org

> **Spec retroactiva** (generada en sesión 24). La feature se implementó en sesiones 18-19
> sin spec previa; este documento reconstruye los requisitos desde el código existente
> y define el alcance restante.

## Contexto

Perfil de organización cliente (Responsable del tratamiento LOPDP) + taxonomía de
campañas por categorías. Las campañas pertenecen a una organización y se clasifican.
Habilita a futuro un catálogo público multi-org.

## Requisitos implementados

- **R1** CUANDO un usuario con rol `admin` solicita `GET /v1/organizaciones`, el sistema DEBERÁ retornar la lista de organizaciones con su conteo de campañas activas.
- **R2** CUANDO un usuario con rol `admin` crea una organización (`POST /v1/organizaciones`), el sistema DEBERÁ persistirla con `name`, `slug` único, y campos opcionales `description`, `logo_url`, `contact_email`, `rep_name`, `domain`.
- **R3** SI el `slug` ya existe, ENTONCES el sistema DEBERÁ responder `409` con mensaje claro.
- **R4** CUANDO un admin edita una organización (`PATCH /v1/organizaciones/{id}`), el sistema DEBERÁ actualizar solo los campos enviados.
- **R5** CUANDO un admin archiva una organización, el sistema DEBERÁ rechazar con `409` SI la organización tiene campañas activas; en caso contrario DEBERÁ marcar `archived_at`/`archived_by` (soft delete).
- **R6** CUANDO se solicita `GET /v1/organizaciones/{id}/campaigns`, el sistema DEBERÁ retornar solo campañas no archivadas de esa organización (id, título, estado, slug).
- **R7** MIENTRAS un usuario no tenga rol `admin`, el sistema DEBERÁ responder `403` a todas las operaciones de escritura y listado de organizaciones.
- **R8** El sistema DEBERÁ soportar categorías de campaña con unicidad por `(slug, org_id)`, nombre con trim, color opcional y archivado suave; duplicados responden `409`.
- **R9** CUANDO el admin visita el detalle de organización, el frontend DEBERÁ mostrar perfil editable, campañas asociadas y gestión inline de categorías.

## Requisitos pendientes (alcance restante de la feature)

- **R10** El sistema DEBERÁ soportar taxonomía de regiones para clasificar campañas (además de temas/categorías).
- **R11** El sistema DEBERÁ exponer un catálogo público multi-org de campañas activas, filtrable por tema y región, respetando branding por campaña.
