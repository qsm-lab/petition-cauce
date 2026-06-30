# Requisitos — landing-campana + ciclo-vida-basico + firmas-recientes + difusion-social
> EARS notation. Fecha: 2026-06-30
> Diseño aprobado: plan/design/design_handoff_cauce_front/CampaignPage.dc.html
> Este spec cubre 4 features del feature_list: landing-campana, ciclo-vida-basico, firmas-recientes, difusion-social

---

## Referencia de diseño

El diseño de referencia es `plan/design/design_handoff_cauce_front/CampaignPage.dc.html`.
El README completo con specs de tokens, layout y componentes está en `plan/design/design_handoff_cauce_front/README.md`.
Todos los valores de píxeles, colores (tokens `--bp`, `--bop`, etc.), tipografías y comportamientos del README son normativos.

---

## Layout y resolución de campaña

**R1** — La página SHALL resolver la campaña desde el `x-campaign-id` header inyectado por el middleware de multidominio (o por `?slug=` en dev), sin leer el slug desde la URL pública.

**R2** — La página SHALL ser un Server Component (Next.js App Router) que fetcha los datos de campaña en el servidor. No habrá flash de contenido sin datos.

**R3** — Los tokens CSS de tema (`--bp`, `--bop`, `--bsec`, `--bink`, `--bmut`, `--bsurf`, `--bbg`, `--bbord`, `--br`, `--fd`, `--fb`) SHALL inyectarse como CSS custom properties en el elemento `<html>` desde el `layout.tsx` raíz, tomando los valores del campo `meta.theme_tokens` de la campaña (JSONB). Si `theme_tokens` está vacío, SHALL usarse el tema por defecto "Bosque" (verde `#18794A`).

**R4** — Las fuentes Poppins (500/600/700/800) e Inter (400/500/600/700) SHALL ser auto-hosteadas en build time (Next.js `next/font/local`). No se cargará desde CDN en runtime.

---

## Layout responsive

**R5** — En mobile (< 768px), la página SHALL ser una columna única con `16px` de padding horizontal y `18px` de gap entre cards. El orden de secciones SHALL ser el descrito en el README sección "Layout Mobile".

**R6** — En desktop (≥ 768px), la página SHALL usar un CSS Grid de dos columnas: `1fr 360px`, gap `26px`, max-width `1180px` centrado con `padding: 0 28px`. La columna derecha (aside) SHALL ser `position: sticky; top: 18px`.

---

## Secciones de la página (normas mínimas — ver README para detalle completo)

**R7 — Hero:** imagen de la campaña con altura `196px` mobile / `300px` desktop. Badge de categoría top-right. Avatar de org bottom-left. Placeholder diagonal cuando no hay imagen.

**R8 — Título:** Poppins 800, `24px` mobile / `34px` desktop, `max-width: 18ch`.

**R9 — Action Block (CTA Card):** contador de firmas, barra de progreso con animación desde 0 al montar, chip "Dirigida a", botón CTA que abre el Sign Flow. Este bloque es observado por `IntersectionObserver` en mobile.

**R10 — Floating CTA (mobile only):** WHEN el Action Block sale del viewport, SHALL aparecer una barra fija en la parte inferior con el mismo botón CTA. Entry animation: `opacity 0→1 + translateY(10px→0)`, 220ms ease-out. SHALL respetar `prefers-reduced-motion`.

**R11 — Ciclo de vida:** 5 pasos ("Lanzada" → "Recolección" → "Entrega" → "Diálogo" → "Decisión"). Paso actual resaltado con `--bp`. Línea de progreso horizontal detrás de los dots. Solo lectura pública (lectura del campo `lifecycle_stage` de la campaña).

**R12 — Petition Body:** sección "Lo que pedimos" con lista de `asks` y sección "Por qué importa" con el cuerpo de la petición (`petition_body`).

**R13 — Feed de firmas recientes:** muestra las últimas firmas confirmadas con `visibility = 'publica'`. Indicador live (dot pulsante). Avatares anónimos para firmas sin nombre. Polling cada 30s o SSE (decidir en implementación). Nota de pie explicando la privacidad.

**R14 — Sección de difusión social:** botones WhatsApp, Telegram, Facebook, X, Email con URLs de share. Input de URL copiable. Placeholder de QR (a reemplazar con QR real en feature `enlace-corto-qr`).

**R15 — Mapa por región:** placeholder con barras por provincia (datos del campo `regions` de la campaña). El SVG choropleth se implementa en Fase 4.

**R16 — Tarjeta de organización:** avatar, nombre, botón "Ver perfil" (sin página de perfil en Fase 1, botón desactivado).

**R17 — Documentos adjuntos:** lista de hasta 5 documentos con nombre, tamaño y botón de descarga (URL firmada con TTL 15min generada por el backend).

---

## Accesibilidad

**R18** — La página SHALL cumplir WCAG 2.1 AA en los 3 temas (Bosque light, Océano light, Bosque dark).

**R19** — La barra de progreso SHALL tener `role="progressbar"` con `aria-valuenow`, `aria-valuemin`, `aria-valuemax` y `aria-label`.

**R20** — Todos los elementos interactivos SHALL tener `min-height / min-width: 44px`.

**R21** — Las animaciones SHALL respetar `prefers-reduced-motion: reduce` (duración efectiva `0.001ms`).

---

## SEO / Open Graph

**R22** — La página SHALL incluir `<title>`, `<meta name="description">` y Open Graph tags (`og:title`, `og:description`, `og:image`) con datos de la campaña, generados en el Server Component.

---

## API que consume

**R23** — `GET /api/v1/campaigns/{campaign_id}` — datos completos de campaña (a crear en `formulario-firma` / endpoints generales).
**R24** — `GET /api/v1/campaigns/{campaign_id}/signatures/recent?limit=10` — últimas firmas públicas (a crear en `dashboard-firmas`).
