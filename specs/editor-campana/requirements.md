# Requirements — editor-campana

## Contexto
Permite al admin crear y editar campañas de petición desde el panel. Actualmente el módulo de campañas filtra por Form.org_id (herencia de forms-qsm), lo que impide crear campañas independientes. Se corrige para usar Campaign.org_id directamente.

---

## Requisitos

**R1** — El admin puede crear una nueva campaña desde `/admin/campanas` con los campos:
- `title` (obligatorio, máx 500 chars)
- `slug` (obligatorio, único global, solo alfanumérico + guiones)
- `category` (opcional: agua, bosques, manglares, mineria, aire, biodiversidad, otro)
- `goal_count` (opcional, entero positivo)
- `authority` (opcional, texto libre — nombre del destinatario/institución)
- `petition_body` (opcional, JSONB — texto del cuerpo de la petición)
- `hero_image_url` (opcional, URL)
- `ends_at` (opcional, fecha de cierre)

**R2** — El admin puede listar todas las campañas de su organización en `/admin/campanas`, mostrando: título, estado, firmas confirmadas, meta de firmas, fecha de cierre, acciones (ver firmas, editar).

**R3** — El admin puede editar todos los campos de R1 desde `/admin/campanas/[id]`.

**R4** — El admin puede cambiar el estado de la campaña (draft → active → closed) desde la página de edición.

**R5** — El sistema filtra campañas por `Campaign.org_id == user.org_id` directamente, sin pasar por la tabla `forms`. (Corrección de bug heredado de forms-qsm.)

**R6** — Al crear una campaña, el backend asigna automáticamente `org_id = current_user.org_id` (actualmente no se asigna).

**R7** — El backend valida unicidad del slug al crear y al editar; devuelve 409 si ya existe.

**R8** — La lista de campañas incluye el conteo de firmas `confirmed` de la tabla `signatures` para mostrar progreso vs. meta.

**R9** — La página `/admin/campanas/[id]` incluye enlace directo a `/admin/campanas/[id]/firmas` y a la landing pública `/?slug=[slug]`.

**R10** — Todos los endpoints de campañas requieren JWT válido (cookie `access_token`). El frontend redirige a `/admin/login` si el usuario no está autenticado.
