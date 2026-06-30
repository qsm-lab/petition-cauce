# Tasks — multidominio
> Referencia: requirements.md R1–R16

---

## API

- [ ] T1 — `app/services/domain_service.py`: `resolve_domain(host: str) -> dict | None` con caché Redis `petition:domain:{host}` TTL 300s (R3, R5)
- [ ] T2 — `app/routers/domains.py`: `GET /api/v1/resolve-domain?host={host}` — llama a `domain_service`, retorna 200 o 404; rate limit 60 req/min (R3, R4)
- [ ] T3 — Registrar router en `app/main.py` (R3)
- [ ] T4 — Invalidar caché Redis al crear/actualizar registro en `domains` (R5)

## Next.js — Middleware

- [ ] T5 — `middleware.ts`: leer `Host` / `X-Forwarded-Host`, sanitizar host (R6, R8)
- [ ] T6 — Fallback dev: si `NODE_ENV=development` y host es localhost/127.0.0.1, leer `?slug=` o usar `DEV_CAMPAIGN_SLUG` (R7, R15)
- [ ] T7 — Llamada a `resolve-domain` desde middleware con `fetch` (URL interna `API_INTERNAL_URL`) (R8)
- [ ] T8 — Inyectar headers `x-campaign-id` y `x-campaign-slug` en la respuesta del middleware (R8)
- [ ] T9 — Redirigir a `not-found` si resolve retorna 404 (R9)
- [ ] T10 — Limitar middleware a rutas públicas; excluir `/admin/*`, `/api/*`, `/_next/*` (R10)
- [ ] T11 — Log en consola solo en `NODE_ENV=development` (R16)

## Next.js — Layout y Server Components

- [ ] T12 — `lib/resolve-campaign.ts`: helper que lee `x-campaign-id` del header y fetcha la campaña completa desde la API (R11)
- [ ] T13 — `app/layout.tsx`: leer `x-campaign-id`, obtener `theme_tokens` del meta JSONB, inyectar como CSS custom properties en `<html>` (R12)
- [ ] T14 — `app/page.tsx`: usar `x-campaign-slug` para render de la campaña raíz (R11)

## Nginx

- [ ] T15 — `infra/nginx/cauce.conf`: cambiar `server_name cauce.ecuadornotlc.org` por `server_name _` + `proxy_set_header Host $host` (R13, R14)

## Verificación

- [ ] T16 — Dev local: `http://localhost:3002/?slug=campana-dev-001` resuelve campaña correctamente
- [ ] T17 — Header `x-campaign-id` visible en Server Component de `app/page.tsx`
- [ ] T18 — Redis: clave `petition:domain:localhost` (o slug fallback) creada con TTL 300s
