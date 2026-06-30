# Tasks — landing-campana
> Referencia: requirements.md R1–R24
> Incluye: ciclo-vida-basico, firmas-recientes, difusion-social

---

## Setup / fuentes

- [ ] T1 — Descargar y copiar a `public/fonts/`: Poppins 500/600/700/800 + Inter 400/500/600/700 (formato woff2)
- [ ] T2 — `app/layout.tsx`: configurar `next/font/local` para Poppins e Inter; mapear a `--fd` y `--fb`

## Tokens de tema

- [ ] T3 — `lib/theme.ts`: `extractThemeTokens(meta: Record<string, unknown>): Record<string, string>` — retorna tokens del JSONB o defaults Bosque si vacío (R3)
- [ ] T4 — `app/layout.tsx`: leer `x-campaign-id`, obtener campaña, inyectar tokens como `style` en `<html>` (R3)

## API — endpoints públicos de campaña

- [ ] T5 — `app/routers/campaigns.py`: `GET /api/v1/campaigns/{campaign_id}` — retorna datos públicos de campaña (sin PII); registrar en `main.py` (R23)
- [ ] T6 — `app/routers/signatures.py`: `GET /api/v1/campaigns/{campaign_id}/signatures/recent?limit=10` — últimas firmas `status=confirmada` y `visibility=publica`; retorna `[{name_or_anon, city, time_ago}]` (R13, R24)

## Server Component raíz

- [ ] T7 — `lib/campaign-api.ts`: `getCampaign(id: string)` — fetch server-side a la API interna (R2)
- [ ] T8 — `app/page.tsx`: Server Component que llama `getCampaign(x-campaign-id)` y pasa datos a `CampaignPage.tsx` (R1, R2)
- [ ] T9 — `<head>`: `<title>`, `<meta description>`, Open Graph tags desde datos de campaña (R22)

## Componentes (Client Components donde aplica)

- [ ] T10 — `Hero.tsx`: imagen / placeholder diagonal, badge categoría, avatar org (R7)
- [ ] T11 — `ActionBlock.tsx`: contador firmas, barra de progreso animada desde 0 (requestAnimationFrame + 60ms timeout), chip autoridad, botón CTA; `role="progressbar"` + `aria-*` (R9, R19)
- [ ] T12 — `ActionBlock.tsx`: IntersectionObserver sobre el card; estado `showFloat`; FloatingCTA mobile con animación fade+slide; respetar `prefers-reduced-motion` (R10, R21)
- [ ] T13 — `LifecycleSteps.tsx`: 5 pasos con dot done/current/future, línea horizontal, labels; datos de `campaign.lifecycle_stage` (R11)
- [ ] T14 — `PetitionBody.tsx`: sección "Lo que pedimos" (lista `asks`) + "Por qué importa" (`petition_body`) (R12)
- [ ] T15 — `RecentSignatures.tsx`: lista de firmas recientes, dot pulsante live, avatar anónimo (🔒) vs nominal; polling `useEffect` cada 30s (R13)
- [ ] T16 — `ShareSection.tsx`: botones WhatsApp, Telegram, Facebook, X, Email; input URL copiable; QR placeholder (R14)
- [ ] T17 — `RegionBars.tsx`: barras horizontales por provincia con porcentaje (R15)
- [ ] T18 — `OrgCard.tsx`: avatar, nombre de org, botón "Ver perfil" (desactivado en Fase 1) (R16)
- [ ] T19 — `Documents.tsx`: lista documentos con nombre, tamaño, botón descarga (fetch URL firmada al click) (R17)

## Layout responsive

- [ ] T20 — `app/(campaign)/layout.css` o Tailwind: grid mobile (col única) y desktop (1fr 360px), sticky aside (R5, R6)

## Verificación

- [ ] T21 — `http://localhost:3002/?slug=campana-dev-001` carga campaña dev con datos reales
- [ ] T22 — Barra de progreso anima desde 0 al montar
- [ ] T23 — Floating CTA aparece al hacer scroll past el Action Block en móvil
- [ ] T24 — Lifecycle stage 1 (Recolección) resaltado correctamente
- [ ] T25 — Tokens tema Bosque aplicados correctamente desde `meta.theme_tokens` o defaults
