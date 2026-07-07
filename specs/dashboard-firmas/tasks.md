# Tasks — dashboard-firmas
> Referencia: requirements.md R1–R28 · design.md D1–D6
> Fecha: 2026-07-01

---

## API — servicio

- [x] T1 — `app/services/admin_signature_service.py`: método `list_signatures(db, campaign_id, org_id, page, per_page, provincia, visibility, status)` → dict con `items`, `total`, `confirmed_count`, `pending_count`, `anulada_count`, `page`, `per_page`, `pages` (R6, R13, R18, D6)
- [x] T2 — `app/services/admin_signature_service.py`: método `export_csv(db, campaign_id, org_id, slug, provincia, visibility, status)` → `StreamingResponse` CSV sin PII (R21–R23, D2)

## API — router

- [x] T3 — `app/routers/admin_signatures.py`: `GET /campaigns/{campaign_id}/signatures` con query params `page`, `per_page`, `provincia`, `visibility`, `status`; auth `get_db_with_org`; valida pertenencia campaign→org y retorna 404 si no coincide (R2, D5)
- [x] T4 — `app/routers/admin_signatures.py`: `GET /campaigns/{campaign_id}/signatures/export.csv`; mismos filtros sin `page`/`per_page`; retorna `StreamingResponse` (R21–R23)
- [x] T5 — `app/main.py`: registrar `admin_signatures.router` bajo prefix `/v1/admin`, tag `admin` (design.md)

## Frontend — helpers

- [x] T6 — `apps/web/src/lib/admin-signatures-api.ts`: función `getAdminSignatures(campaignId, params)` → llama `apiServer("/v1/admin/campaigns/{id}/signatures?...")` y retorna el response tipado (design.md)
- [x] T7 — Definir interfaces TypeScript: `AdminSignatureItem`, `AdminSignaturesResponse` en `admin-signatures-api.ts` (design.md)

## Frontend — página

- [x] T8 — `apps/web/src/app/admin/campanas/[id]/firmas/page.tsx`: Server Component; lee `searchParams` (`page`, `provincia`, `visibility`, `status`); llama `getAdminSignatures`; renderiza header, stats, filtros, tabla, paginación (R1–R5, R6, D3)
- [x] T9 — Header: nombre de campaña (desde el response) + breadcrumb "Campañas / [nombre] / Firmas" con link a `/admin/campanas` (R4, R5)
- [x] T10 — Chips de estadísticas: "N confirmadas · M pendientes · K anuladas" (R6)
- [x] T11 — `FiltrosBar.tsx` (`"use client"`): `<form method="GET">` con tres selects (provincia, visibilidad, estado); `onChange → form.requestSubmit()`; valores iniciales desde props (searchParams actuales) (R17–R20, D3)
- [x] T12 — `ExportCsvButton.tsx` (`"use client"`): `window.open(NEXT_PUBLIC_API_URL + "/v1/admin/campaigns/{id}/signatures/export.csv?" + qs, "_blank")`; desactivado si `total_count = 0`; pasa filtros activos en la URL (R21, R24, D3, D4 análogía ExportButtons.tsx)
- [x] T13 — Tabla `<table>` con `<thead>/<tbody>/<th scope="col">`: columnas Nombre, Provincia, Visibilidad, Estado, Confirmada el, Registrada el (R7, R26)
- [x] T14 — Badge visibilidad: Pública (verde), Anónima (gris), Secreta (rojo) — texto visible + color (R8, R28)
- [x] T15 — Badge estado: Confirmada (verde), Pendiente (naranja), Anulada (rojo) — texto visible + color (R9, R28)
- [x] T16 — Fila anulada: `opacity-[0.45]` en el `<tr>` (R10)
- [x] T17 — Paginación: `<Link href="?page=N&...">` construido desde `searchParams` actuales; botones Anterior/Siguiente con `aria-label` y `disabled`/`aria-disabled` correctos; indicador "Mostrando X–Y de Z firmas"; ocultar si `pages <= 1` (R13–R16, R27)
- [x] T18 — Estado vacío: mensaje distinto según si hay filtros activos o no (R25)

## Verificación

- [x] T19 — `GET /v1/admin/campaigns/{id}/signatures` sin filtros → lista con paginación y stats
- [x] T20 — `GET /v1/admin/campaigns/{id}/signatures?visibility=publica` → solo firmas públicas; `total` actualizado
- [x] T21 — `GET /v1/admin/campaigns/{id}/signatures?page=2` → segunda página
- [x] T22 — `GET /v1/admin/campaigns/{id}/signatures/export.csv` → archivo descargable con columnas correctas, sin email ni cédula
- [ ] T23 — Acceso con campaña de otra org → 404
- [x] T24 — Acceso sin JWT → 401
- [ ] T25 — Página `/admin/campanas/{id}/firmas` en browser → tabla visible con datos de la campaña dev
- [ ] T26 — Cambiar filtro provincia en browser → tabla se recarga; URL refleja el filtro
- [ ] T27 — Botón "Exportar CSV" → descarga el archivo `.csv` con datos correctos
- [ ] T28 — Campaña sin firmas → estado vacío visible
