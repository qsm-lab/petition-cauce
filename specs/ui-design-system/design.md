# Design — ui-design-system

Feature: Sistema de diseño UI
Fase: 0 | Área: frontend

---

## Archivos afectados / creados

### Nuevos
```
apps/web/src/lib/design-tokens.ts          — tokens base (colores, tipografía, espaciado)
apps/web/src/components/ui/Button.tsx
apps/web/src/components/ui/Card.tsx
apps/web/src/components/ui/Badge.tsx
apps/web/src/components/ui/FormField.tsx
apps/web/src/components/ui/Alert.tsx
apps/web/src/components/ui/index.ts        — barrel export
apps/web/public/fonts/                     — fuentes auto-hosteadas
specs/ui-design-system/design-export.html — referencia HTML exportado de Claude Design
```

### Modificados
```
apps/web/tailwind.config.ts    — extender tema con tokens y fuentes del sistema de diseño
apps/web/src/app/layout.tsx    — aplicar fuentes auto-hosteadas y variables CSS base
apps/web/src/app/globals.css   — definir variables CSS custom properties
```

---

## Decisiones de diseño

### Tokens como CSS custom properties + extensión Tailwind
Los tokens semánticos (`--brand-primary`, etc.) se definen como CSS custom properties en `:root` dentro de `globals.css`. Se extienden en `tailwind.config.ts` con `var(--brand-primary)` para que las clases Tailwind los consuman. Esto permite sobreescribir los tokens por campaña inyectando un `<style>` en el layout server-side sin recompilar Tailwind.

**Alternativa descartada:** Tokens como constantes TypeScript importadas en cada componente — no permite sobreescritura en runtime por campaña sin re-render.

### Fuentes auto-hosteadas
Se usa `next/font/local` para todas las fuentes. Esto evita requests a Google Fonts / Adobe Fonts en runtime, cumple con las restricciones de privacidad LOPDP (no enviar IP de usuario a terceros por cargar una fuente) y mejora el CLS.

**Fuentes candidatas para el sistema base (neutro):**
- `Inter` — body y UI (open source, libre de restricciones)
- `Fraunces` o `Playfair Display` — headings con carácter activista (open source)

La elección final se decide en el paso de diseño Claude Design.

### Componentes como Server Components por defecto
Cumple con el patrón Next.js 14 App Router. Solo `FormField` y cualquier componente con `onChange`/`useState` llevan `"use client"`. El resto son pure functional components sin directiva.

### Branding por campaña — inyección SSR
En el layout de campaña (a implementar en `landing-campana`), el servidor consulta `meta.branding` de la campaña y genera un `<style>` inline con las variables CSS sobreescritas. Esto evita flash de estilos incorrectos (FOUC) que ocurriría con un approach de cliente.

```tsx
// Patrón de inyección (layout de campaña, feature futura)
<style>{`
  :root {
    --brand-primary: ${branding.primary_color};
    --brand-secondary: ${branding.secondary_color};
  }
`}</style>
```

### Sin CSS-in-JS
Tailwind únicamente. Sin `styled-components`, `emotion` ni módulos CSS. El HTML exportado de Claude Design se traduce a clases Tailwind; el CSS inline del export se descarta.

---

## Seguridad

- No hay superficie de ataque nueva: son componentes estáticos y clases Tailwind.
- La inyección del `<style>` de branding por campaña debe sanitizar los valores de color (validar formato hex/rgb antes de insertar) para evitar CSS injection. **Esto se implementa en la feature `landing-campana`, no aquí.**
- Las fuentes auto-hosteadas eliminan el vector de tracking de terceros por fuentes CDN.

---

## LOPDP

No aplica directamente. Este sistema de diseño no procesa ni almacena datos personales. El campo `meta.branding` contiene únicamente datos de presentación (colores, logos, copys) — no PII.

---

## Dependencias

| Dependencia | Versión | Motivo |
|-------------|---------|--------|
| `tailwindcss` | ya instalado | base |
| `clsx` | latest | condicionales de clase sin template literals complejos |
| `tailwind-merge` | latest | merge seguro de clases Tailwind en variantes |
| Fuentes (archivos) | — | se descargan y commitean en `public/fonts/` |

---

## No incluye esta feature

- Implementación del branding por campaña (inyección desde DB) → `landing-campana`
- Editor de branding admin → `editor-branding` (Fase 2)
- Dark mode → no planificado en Fase 0
- Storybook → no planificado; los componentes son simples y auditables directamente
