# Tasks — landing-respaldo-entrega

> No empezar hasta que `requirements.md` y `design.md` estén aprobados por
> el usuario, y hasta tener el diseño visual aprobado en Claude Design
> (ver sección "Diseño visual" en design.md).

## 0. Diseño visual (bloqueante para frontend)
- [ ] Maquetar en Claude Design (Adobe Express): encabezado, bloque de
      cuantificación, línea de fechas, 3 bloques de texto fijo, botón de
      descarga de QR. Tono institucional/formal.
- [ ] Exportar HTML → guardar en `specs/landing-respaldo-entrega/design-export.html`.
- [ ] Aprobación del usuario sobre el diseño exportado.

## 1. Backend
- [ ] `signature_service.get_respaldo_stats(db, campaign_id)` — total
      confirmadas, desglose por `visibility`, desglose por
      `provincia`/`country` (R7, R8, R9, R10).
- [ ] `campaign_service.get_respaldo_dates(db, campaign)` — lanzamiento,
      cierre, generado_al (R11).
- [ ] `app/content/respaldo_content.py` (o similar) — texto fijo de
      seguridad (R12), fiabilidad (R13, respetando R14) y privacidad (R15).
- [ ] Schema `RespaldoPublicOut` en `app/schemas/`.
- [ ] Endpoint `GET /v1/public-campaign/by-slug/{slug}/respaldo` — 404 solo
      si el slug no existe, sin filtrar por `archived_at`/`status` (R1, R2,
      R3).
- [ ] Confirmar que la respuesta no incluye ningún campo de PII individual
      (revisar el schema campo por campo contra R17).

## 2. Frontend
- [ ] `apps/web/src/app/c/[slug]/respaldo/page.tsx` — Server Component,
      fetch al endpoint nuevo, render de todas las secciones.
- [ ] `metadata.robots = { index: false, follow: false }` (R4).
- [ ] `DownloadQrButton.tsx` (client component) — genera PNG con `qrcode`
      a partir de la URL completa de la página (R16).
- [ ] Traducir el HTML exportado de Claude Design a Tailwind (regla del
      proyecto: sin CSS inline, sin CSS-in-JS).

## 3. Tests (R18)
- [ ] 200 con campaña archivada (`archived_at` no nulo).
- [ ] 200 con campaña `status="closed"`.
- [ ] 404 con slug inexistente.
- [ ] Agregación correcta por tipo de visibilidad (incluye conteo de
      `secreta` sin exponer nombres).
- [ ] Agregación correcta por origen (provincia + país, incluye caso sin
      firmas internacionales).
- [ ] El JSON de respuesta no contiene ningún campo de nombre/cédula/email
      individual (assert explícito sobre las keys del schema).
- [ ] Meta `noindex` presente en el HTML renderizado.

## 4. Verificación manual
- [ ] Probar en navegador con la campaña de prueba de dev, con y sin
      firmas internacionales, con campaña archivada.
- [ ] Confirmar que el QR descargado apunta a la URL correcta y es
      legible.
