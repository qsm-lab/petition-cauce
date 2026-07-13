# Diseño técnico — dashboard-firmas
> Fecha: 2026-07-01

---

## Archivos nuevos

### API (apps/api)
- `app/routers/admin_signatures.py` — 2 endpoints: lista paginada + export CSV
- `app/services/admin_signature_service.py` — queries sobre tabla `signatures`
- `app/main.py` — registrar el router bajo `/v1/admin`

### Next.js (apps/web)
- `app/admin/campanas/[id]/firmas/page.tsx` — Server Component, lee `searchParams`
- `app/admin/campanas/[id]/firmas/FiltrosBar.tsx` — `"use client"`, `<form method="GET">`
- `app/admin/campanas/[id]/firmas/ExportCsvButton.tsx` — `"use client"`, `window.open()`
- `lib/admin-signatures-api.ts` — helpers de fetch server-side para esta feature

---

## API — endpoints

### GET /v1/admin/campaigns/{campaign_id}/signatures

Auth: `get_db_with_org` (cookie JWT + RLS `app.current_org_id`).

Query params:
| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `page` | int | 1 | Página actual |
| `per_page` | int | 50 | Resultados por página (max 200) |
| `provincia` | str \| None | None | Filtro provincia exacta |
| `visibility` | str \| None | None | `publica` / `anonima` / `secreta` |
| `status` | str \| None | None | `confirmed` / `pending_confirmation` / `anulada` |

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Juan Pérez",
      "provincia": "Pichincha",
      "visibility": "publica",
      "status": "confirmed",
      "confirmed_at": "2026-06-15T14:23:00Z",
      "created_at": "2026-06-15T14:20:00Z"
    }
  ],
  "total": 823,
  "confirmed_count": 810,
  "pending_count": 11,
  "anulada_count": 2,
  "page": 1,
  "per_page": 50,
  "pages": 17
}
```

Ordenado por `created_at DESC` (no configurable en Fase 1).

### GET /v1/admin/campaigns/{campaign_id}/signatures/export.csv

Mismos query params de filtro que el endpoint de lista (sin `page`/`per_page`).
Retorna `StreamingResponse` con `Content-Type: text/csv; charset=utf-8`.
`Content-Disposition: attachment; filename="firmas-{slug}-{YYYY-MM-DD}.csv"`.
Columnas: `id,nombre,provincia,visibilidad,estado,confirmada_el,registrada_el`.

---

## Servicio — AdminSignatureService

```python
class AdminSignatureService:
    @staticmethod
    async def list_signatures(
        db, campaign_id, org_id,
        page=1, per_page=50,
        provincia=None, visibility=None, status=None
    ) -> dict: ...

    @staticmethod
    async def export_csv(
        db, campaign_id, org_id, slug,
        provincia=None, visibility=None, status=None
    ) -> StreamingResponse: ...
```

El filtro por `org_id` es doble seguridad: la RLS ya lo enforce a nivel PostgreSQL, pero se agrega
`WHERE signatures.org_id = :org_id` en la query para no depender solo de RLS.

Los campos `email_encrypted` y `cedula_encrypted` NO se incluyen en ningún response
de este servicio en Fase 1.

---

## Frontend — estructura

### page.tsx (Server Component)

```
/admin/campanas/[id]/firmas/page.tsx
  searchParams: { page?, provincia?, visibility?, status? }
  ↓ apiServer("/v1/admin/campaigns/{id}/signatures?...")
  ↓ render:
    Header (nombre campaña, breadcrumb)
    Chips de estadísticas (confirmed_count, pending_count, anulada_count)
    <FiltrosBar /> (client)        ← valores actuales de searchParams
    <ExportCsvButton /> (client)   ← pasa filtros actuales + campaign_id
    <table> … </table>             ← renderizado server
    Paginación (links con searchParams)
```

### FiltrosBar.tsx ("use client")

`<form method="GET">` con tres `<select>`. Al cambiar un select, el form se submit automáticamente
(`onChange → form.requestSubmit()`). Los `<select>` tienen `name` que coincide con el query param.
El `page` se resetea a 1 al cambiar filtros (hidden input `page=1` que se sobre-escribe con el searchParam actual solo en los links de paginación).

### ExportCsvButton.tsx ("use client")

```tsx
const url = `${NEXT_PUBLIC_API_URL}/v1/admin/campaigns/${id}/signatures/export.csv?${qs}`;
window.open(url, "_blank");
```

Patrón idéntico al `ExportButtons.tsx` existente en `/admin/campaigns/[id]/`.

---

## Decisiones de diseño

**D1 — Router separado `admin_signatures.py`, no en `dashboard.py`.**
`dashboard.py` tiene stats generales y no importa el modelo `Signature`.
Separar evita que `dashboard.py` crezca sin límite.

**D2 — Sin columnas PII en Fase 1 (email, cédula).**
`email_encrypted` y `cedula_encrypted` requieren decryption con la clave del VPS.
El módulo de decryption y el export con PII se implementan en Fase 3 (`cifrado-reposo`).
El admin puede gestionar firmas con nombre + provincia + estado sin exponer PII.

**D3 — Filtros en URL (searchParams), no en estado React.**
URL compartible, funciona con el botón atrás, sin hidratación JS para la tabla.
Solo `FiltrosBar` y `ExportCsvButton` son Client Components.

**D4 — Paginación con links `<a href>`, no `useRouter`.**
Los controles de paginación son `<Link href="?page=N&...">` — sin JS para navegar.
El Server Component lee `searchParams.page` y lo pasa a `apiServer`.

**D5 — `get_db_with_org` como única dependencia de auth en la API.**
Encapsula: verificar JWT, obtener `user.org_id`, setear `app.current_org_id` para RLS.
No se repite lógica de auth en `admin_signatures.py`.

**D6 — Doble guarda org_id en el servicio.**
`WHERE signatures.campaign_id = :campaign_id AND signatures.org_id = :org_id`
además del RLS. Previene data leak si RLS se desactiva por error de migración.

---

## Seguridad

- Auth vía cookie JWT (mismo mecanismo que el resto del admin).
- RLS activo: `app.current_org_id` bloquea acceso cross-org a nivel PostgreSQL.
- Doble filtro `org_id` en la query del servicio (D6).
- Sin PII en respuestas de Fase 1 — email/cédula cifrados no se envían al frontend.
- Export CSV requiere sesión activa (mismo JWT cookie en la petición del browser).
- Rate limiting no aplicado a endpoints admin (asumiendo sesión autenticada, baja frecuencia).

---

## LOPDP

- **Base de legitimación del acceso:** interés legítimo del Encargado (la plataforma) y
  obligación contractual con el Responsable (la org activista) — Art. 8 LOPDP.
- **Minimización:** solo campos necesarios para gestión operativa (sin email/cédula en Fase 1).
- **Trazabilidad:** el log de acceso de FastAPI registra qué usuario descargó el CSV
  (combinado con los headers de request). Audit log completo se agrega en Fase 3.
- **Retención del CSV descargado:** responsabilidad del Responsable (org activista)
  conforme al contrato de encargo de tratamiento. La plataforma no retiene copias.

---

## Addendum — sesión 31

Ampliaciones sobre el diseño original, implementadas junto con `export-entrega`:

- **Masking de `name` por rol** en `list_signatures`/`export_csv`: `role='gestor'`
  no ve el nombre si `visibility='secreta'`; `role='admin'` (plataforma) sí. La
  minimización pasó de "no guardar el nombre" (bug corregido, ver
  `signature_service.create_signature`) a "no exponerlo según rol/visibilidad" —
  el dato ahora sí se persiste siempre.
- **Columna Origen** (ex-Provincia): `provincia`/`country` son mutuamente
  excluyentes en el modelo, sin migración necesaria. Filtro `provincia=internacional`
  agrupa `country IS NOT NULL`.
- **`(org) nombre`** en la columna Nombre cuando `signer_type='org'` — formato
  solo de display, sin cambio de modelo (`org_name` ya existía).
- **Botón "Recordar a pendientes"**: nuevo endpoint
  `POST /campaigns/{id}/signatures/remind-pending`, regenera
  `confirmation_token`/`confirmation_token_expires_at` (el original expira a las
  24h) y reenvía el email de confirmación a todo `publica`+`pending_confirmation`
  de la campaña. Pendiente explícito del usuario: sumar `anonima`/`secreta`
  (requiere copy sin mención al nombre — ver `remediacion-nombres-incompletos`).
