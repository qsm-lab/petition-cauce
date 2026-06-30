# Diseño técnico — multidominio
> Fecha: 2026-06-30

---

## Archivos afectados

### API (FastAPI)
- `app/routers/domains.py` — endpoint `GET /api/v1/resolve-domain`
- `app/services/domain_service.py` — lógica de resolución + caché Redis
- `app/models/domain.py` — ya existe (modelo-base)
- `app/main.py` — registrar router

### Next.js (apps/web)
- `middleware.ts` — leer Host, llamar resolve-domain, inyectar headers
- `app/layout.tsx` — leer `x-campaign-id` desde headers, inyectar tokens CSS
- `app/page.tsx` — campaña pública raíz (usa headers inyectados)
- `lib/resolve-campaign.ts` — helper server-side para obtener campaña por id/slug

### Nginx / infra
- `infra/nginx/cauce.conf` — `server_name _` para aceptar cualquier host

---

## Decisiones de diseño

**D1 — Cache en Redis, no en Next.js.**
`resolve-domain` es llamado en cada request de middleware. Cachear en Redis (TTL 5min) evita una query a BD por cada pageview. Next.js también cachea automáticamente fetch con `cache: 'force-cache'` pero no garantiza invalidación. Redis es la fuente de verdad para el TTL.

**D2 — Headers x-campaign-id / x-campaign-slug, no cookies.**
Los Server Components de Next.js pueden leer headers entrantes de forma síncrona. Las cookies requieren `cookies()` async. Los headers son más simples y no persisten entre visitas.

**D3 — Dominio de campaña ≠ ruta.**
`/` en `firma.ec` sirve la campaña de ese dominio. No hay `/campañas/:slug` pública. El slug es solo para admin y para desarrollo local. Esto es transparente para el firmante.

**D4 — Fallback en dev por `?slug=`.**
En `localhost:3002`, el middleware lee `?slug=campana-dev-001`. Esto permite desarrollar cualquier campaña sin configurar DNS ni tabla `domains`.

**D5 — TLS por Cloudflare, no por nginx.**
Para MVP, todos los dominios van a Cloudflare con proxy naranja (SSL/TLS Full). Nginx no necesita certificados. Futuro: Let's Encrypt cuando haya dominios fuera de Cloudflare.

---

## Seguridad

- `resolve-domain` no expone datos de PII; solo devuelve `campaign_id`, `campaign_slug`, `org_id`, `theme_meta`.
- Rate limiting en `resolve-domain`: 60 req/min por IP (Redis + slowapi).
- El header `Host` se sanitiza antes de pasarlo a la query (strip de puerto, lowercase).
- No se permite `resolve-domain` con hosts internos Docker (`petition-api`, `petition-db`, etc.).

---

## Sin implicaciones LOPDP

Esta feature no trata datos personales. No requiere `privacy_config` adicional.
