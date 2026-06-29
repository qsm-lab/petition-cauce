# Tasks — ui-design-system

Feature: Sistema de diseño UI
Fase: 0 | Área: frontend

---

## Estado

- [x] Spec aprobada por usuario
- [x] Diseño en Claude Design aprobado (handoff recibido: `design_handoff_plataforma_firmas/`)
- [x] HTML exportado guardado (3 archivos `.dc.html` + README en specs/)

---

## Bloque D — Diseño (Claude Design → HTML)

- [x] **D1** Diseñar en Claude Design: paleta de colores base, tipografías, espaciado (R1, R6)
- [x] **D2** Diseñar componentes base en Claude Design: Button, Card, Badge, FormField, Alert (R8)
- [x] **D3** Revisar contraste WCAG AA en el diseño (R11) — garantizado en los 3 presets según README
- [x] **D4** HTML exportado guardado en `specs/ui-design-system/design_handoff_plataforma_firmas/` (R13, R14)
- [x] **D5** Aprobación del usuario sobre el diseño exportado

---

## Bloque T — Tokens y configuración Tailwind

- [x] **T1** Variables CSS en `globals.css`: 9 tokens semánticos + aliases canónicos + animaciones (R6, R7)
- [x] **T2** `tailwind.config.ts` extendido con tokens `brand-*` → `var(--bp)` etc. (R1)
- [x] **T3** `tailwind-merge` instalado + `cn()` actualizado en `utils.ts` (R8)
- [x] **T4** Fuentes auto-hosteadas via `next/font/google` (build-time): Poppins 500/600/700/800 + Inter 400/500/600/700 (R4)
- [x] **T5** Fuentes registradas en `layout.tsx` con variables `--font-poppins` / `--font-inter` (R4)
- [x] **T6** Escala tipográfica en `tailwind.config.ts`: `font-display` (Poppins) + `font-body` (Inter) (R5)
- [x] **T7** `design-tokens.ts` creado: tipos, 3 presets, `tokensToStyle()`, `campaignStyleTag()` sanitizado (R1, R2)

---

## Bloque C — Componentes base

- [x] **C1** `Button.tsx` — variantes primary/secondary/ghost/danger, tamaños sm/md/lg (R8, R9, R10)
- [x] **C2** `Card.tsx` — CardHeader, CardTitle, CardBody, CardFooter opcionales (R8, R10)
- [x] **C3** `Badge.tsx` — variantes de ciclo de vida (draft/active/collecting/delivered/dialog/decided) + category (R8, R10)
- [x] **C4** `FormField.tsx` + `SelectField.tsx` — label + input/textarea/select + error + disabled (`"use client"`) (R8, R9, R12)
- [x] **C5** `Alert.tsx` — variantes info/success/warning/error, role/aria-live correctos (R8, R10, R12)
- [x] **C6** `index.ts` — barrel export de todos los componentes ui (R8)

---

## Bloque V — Verificación

- [ ] **V1** Revisar fidelidad visual de cada componente vs. design-export (R13, R15)
- [x] **V2** No hay `style` inline en ningún componente — todo Tailwind (R15)
- [ ] **V3** Verificar en browser que las fuentes cargan sin requests a CDN externo (R4)
- [ ] **V4** Probar inyección de tokens de campaña: sobreescribir `--bp` y confirmar que Button/Badge lo aplican (R2, R7)
- [x] **V5** `make dev` levanta sin errores + TypeScript sin errores + frontend responde 307 (R1)
