# Diseño técnico — landing-campana
> Fecha: 2026-06-30
> Diseño de referencia: plan/design/design_handoff_cauce_front/CampaignPage.dc.html

---

## Archivos afectados

### Next.js (apps/web)
- `app/layout.tsx` — inyección de tokens CSS de tema, fuentes auto-hosteadas
- `app/page.tsx` — Server Component raíz de la campaña pública
- `app/(campaign)/CampaignPage.tsx` — componente cliente con IntersectionObserver y estado
- `app/(campaign)/components/Hero.tsx`
- `app/(campaign)/components/ActionBlock.tsx` — CTA card + floating CTA mobile
- `app/(campaign)/components/LifecycleSteps.tsx`
- `app/(campaign)/components/PetitionBody.tsx`
- `app/(campaign)/components/RecentSignatures.tsx` — polling cada 30s
- `app/(campaign)/components/ShareSection.tsx`
- `app/(campaign)/components/RegionBars.tsx`
- `app/(campaign)/components/OrgCard.tsx`
- `app/(campaign)/components/Documents.tsx`
- `lib/campaign-api.ts` — funciones fetch a la API (server-side)
- `lib/theme.ts` — helper para extraer tokens del meta JSONB o usar defaults
- `public/fonts/` — Poppins e Inter auto-hosteadas

### API (FastAPI) — endpoints nuevos
- `app/routers/campaigns.py` — `GET /api/v1/campaigns/{campaign_id}` (datos públicos)
- `app/routers/signatures.py` — `GET /api/v1/campaigns/{campaign_id}/signatures/recent`

---

## Decisiones de diseño

**D1 — Server Component para datos; Client Component para interactividad.**
`app/page.tsx` fetcha la campaña en el servidor (sin loading state visible). El IntersectionObserver, el polling de firmas recientes y la apertura del Sign Flow son en el Client Component `CampaignPage.tsx`. Esto garantiza buenas métricas de LCP.

**D2 — Tokens CSS en `<html>`, no inline en cada componente.**
`layout.tsx` lee `meta.theme_tokens` y los inyecta como `style` en `<html>`. Todos los componentes usan `var(--bp)` sin conocer los valores concretos. Cambiar el tema de una campaña no requiere re-render de componentes.

**D3 — Fuentes auto-hosteadas con `next/font/local`.**
Poppins: wght 500/600/700/800. Inter: wght 400/500/600/700. Se copian a `public/fonts/` en el build. No hay petición a Google Fonts en runtime. Mapeo a `--fd` y `--fb` vía CSS variables.

**D4 — Polling de firmas recientes cada 30s.**
SSE implicaría mantener conexiones abiertas persistentes. Para Fase 1, polling cada 30s en `RecentSignatures.tsx` con `useEffect + setInterval` es suficiente. Se migrará a SSE en Fase 5 si hay presión de escala.

**D5 — Placeholder de mapa hasta Fase 4.**
El choropleth SVG de Ecuador requiere datos georreferenciados y una librería de mapas. En Fase 1 se muestran barras horizontales por provincia con los mismos datos. La spec de Fase 4 (`mapa-geografico`) reemplazará este componente.

**D6 — QR placeholder hasta feature `enlace-corto-qr`.**
El QR se mostrará como un cuadro con patrón diagonal. La generación real se implementa en `enlace-corto-qr` (Fase 2).

**D7 — El endpoint de campaña retorna datos públicos sin PII.**
`GET /api/v1/campaigns/{campaign_id}` devuelve todos los campos de campaña excepto datos de firmantes. Las firmas recientes pasan por `RecentSignatures` con filtro `visibility = 'publica'` y sin nombres reales para firmas anónimas.

---

## Tokens CSS — defaults tema Bosque

```css
--bp: #18794A; --bop: #ffffff; --bsec: #2F855A;
--bink: #15241B; --bmut: #5A6B60; --bsurf: #ffffff;
--bbg: #EEF4EC; --bbord: #DBE6D6; --br: 24px;
--fd: 'Poppins', sans-serif; --fb: 'Inter', sans-serif;
```

---

## Seguridad

- El endpoint público de campaña no expone PII.
- Las URLs de descarga de documentos son firmadas con TTL 15min (generadas por la API bajo demanda).
- Los botones de share no incluyen datos del firmante; solo la URL pública de la campaña.

---

## LOPDP

- El aviso de privacidad se enlaza desde el Sign Flow (feature `formulario-firma`), no desde la landing.
- La landing no recopila datos personales; no requiere `privacy_config`.
