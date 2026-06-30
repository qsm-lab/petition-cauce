# Requisitos — multidominio
> EARS notation. Fecha: 2026-06-30

---

## Tabla `domains` (ya existe desde modelo-base)

**R1** — La tabla `domains` SHALL tener los campos: `id UUID PK`, `campaign_id UUID NOT NULL FK campaigns`, `host VARCHAR(255) NOT NULL UNIQUE`, `tls_status VARCHAR(20) NOT NULL DEFAULT 'pendiente'` (valores: `pendiente`, `activo`, `error`), `verified_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.

**R2** — Cada host en `domains` SHALL ser único en toda la plataforma (un dominio solo puede apuntar a una campaña).

---

## API — resolución de campaña por dominio

**R3** — El sistema SHALL exponer un endpoint `GET /api/v1/resolve-domain?host={host}` que retorna `{ campaign_id, campaign_slug, org_id, theme_meta }` si el host existe en `domains` y la campaña está activa; `404` en otro caso.

**R4** — El endpoint `resolve-domain` SHALL ser público (sin autenticación) y estar protegido con rate limiting de 60 req/min por IP.

**R5** — El resultado de `resolve-domain` SHALL estar cacheado en Redis con clave `petition:domain:{host}` y TTL de 300 segundos. La caché SHALL invalidarse cuando se modifique el registro en `domains`.

---

## Next.js — middleware de resolución por Host

**R6** — El middleware de Next.js (`middleware.ts`) SHALL leer el header `Host` (o `X-Forwarded-Host` si el anterior no está disponible) en cada request entrante.

**R7** — WHEN el host es `localhost`, `127.0.0.1` o cualquier valor con puerto explícito (`*:3002`), el middleware SHALL usar el `campaign_slug` del query param `?slug=` si está presente, o el slug por defecto `campana-dev-001` en desarrollo.

**R8** — WHEN el host es un dominio de producción, el middleware SHALL llamar internamente a `resolve-domain` para obtener `campaign_id` y `campaign_slug`, e inyectarlos como headers (`x-campaign-id`, `x-campaign-slug`) en el request para los Server Components.

**R9** — WHEN `resolve-domain` retorna `404`, el middleware SHALL redirigir a una página `not-found` con HTTP 404.

**R10** — El middleware SHALL aplicarse ONLY a rutas bajo `/(campaña pública)`, no a `/admin/*`, `/api/*` ni `/_next/*`.

---

## Next.js — uso del campaign_id en Server Components

**R11** — Los Server Components de la campaña pública SHALL leer `campaign_id` desde el header `x-campaign-id` inyectado por el middleware (no desde la URL).

**R12** — El tema visual (tokens CSS) de la campaña SHALL provenir del campo `meta` JSONB de la campaña (`theme_tokens`), inyectado como variables CSS en el `<html>` desde un Server Component raíz.

---

## Nginx (para deploy)

**R13** — La configuración de nginx SHALL aceptar cualquier `server_name` (wildcard `_`) y hacer proxy hacia Next.js en el contenedor interno, pasando el header `Host` original intacto.

**R14** — No se requiere configurar TLS en nginx para los dominios de campaña; el TLS es responsabilidad de Cloudflare (proxy naranja). Nginx solo escucha en `80`.

---

## Desarrollo local

**R15** — En entorno `development`, el sistema SHALL funcionar sin tabla `domains` configurada, resolviendo la campaña por `?slug=campana-dev-001` o variable de entorno `DEV_CAMPAIGN_SLUG`.

**R16** — El middleware SHALL loguear en consola el `host` resuelto y el `campaign_id` resultante solo en `NODE_ENV=development`.
