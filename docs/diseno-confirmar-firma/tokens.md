# Tokens de diseño que ya usa la landing

Fuente: `apps/web/src/app/globals.css`, `apps/web/tailwind.config.ts`, `apps/web/src/app/layout.tsx` y `ActionBlock.tsx`.
La pantalla de confirmar usa los valores **por defecto (Bosque)**; ninguna campaña los sobreescribe aquí.

## Colores
| Token | Valor | Uso |
|---|---|---|
| `--bp` | `#D7F24C` | Lime: botón principal y acentos |
| `--bop` | `#16261F` | Texto sobre lime |
| `--bsec` | `#DCE9E6` | Verde claro, superficies secundarias |
| `--bink` | `#16261F` | Texto principal |
| `--bmut` | `rgba(22,38,31,0.55)` | Texto secundario |
| `--bsurf` | `#ffffff` | Tarjetas |
| `--bbg` | `#EDF4F1` | Fondo de página (sage claro) |
| `--bbord` | `rgba(22,38,31,0.15)` | Bordes |
| `--ok` | `#3d6b35` | Éxito (del export anterior) |
| `--danger` | `#c2410c` | Error |
| `--amber` | `#b45309` | Aviso (vencido); fondo de aviso `#FEF3C7` |

```css
:root{
  --bp:#D7F24C; --bop:#16261F; --bsec:#DCE9E6; --bink:#16261F; --bmut:rgba(22,38,31,.55);
  --bsurf:#fff; --bbg:#EDF4F1; --bbord:rgba(22,38,31,.15); --br:14px;
  --ok:#3d6b35; --okbg:color-mix(in srgb,#3d6b35 10%,transparent);
  --danger:#c2410c; --dangerbg:color-mix(in srgb,#c2410c 9%,transparent);
  --amber:#b45309; --amberbg:color-mix(in srgb,#b45309 12%,transparent);
}
```

## Tipografía
- **Títulos de impacto:** Anton (400), mayúsculas habituales en la landing. Variable `--font-anton`.
- **Todo lo demás:** Work Sans 400 / 500 / 600 / 700 / 800. Variable `--font-work-sans`.
- En el HTML de diseño: `https://fonts.googleapis.com/css2?family=Anton&family=Work+Sans:wght@400;500;600;700;800&display=swap`.
- En producción se auto-hospedan con `next/font` (no se cargan desde CDN).

## Forma
- Radio de tarjeta: 16 px (`rounded-card`); radio base de campaña: 14 px (`--br`); botones principales muy redondeados (26–30 px, casi píldora).
- Sombra de tarjeta: `0 10px 30px color-mix(in srgb, var(--bp) 9%, transparent)`.
- Sombra al pasar por el botón: `0 6px 18px rgba(22,38,31,0.18)`.

## Botón principal (calcar de la landing)
```
fuente Work Sans 700, 18 px · color #16261F · fondo #D7F24C · borde 1.5px sólido #16261F
radio 30 px · padding 18px 24px · ancho 100 %
hover: escala 1.03 + sombra · active: escala .99 · deshabilitado: fondo rgba(22,38,31,.1), texto rgba(22,38,31,.4)
```
Botón secundario: mismo tamaño y radio, fondo transparente o blanco, borde 1.5 px `#16261F`, texto `#16261F`.

## Movimiento (ya definido en `globals.css`)
| Animación | Uso sugerido |
|---|---|
| `pc-pop` (0,4 s, escala 0,6 → 1,08 → 1) | Marca de verificación del éxito |
| `pc-spin` (0,9 s lineal) | Indicador de «Confirmando…» |
| `pc-float-in` (0,22 s) | Aparición de la tarjeta |
| `pc-rise` (0,25 s) | Cambio entre estados |
Con `prefers-reduced-motion` todas se reducen a casi cero.

## Patrones ya existentes en la landing (para continuidad)
- Aviso tras volver del correo: franja fija arriba, lime si es éxito y `#FEF3C7` si es vencido (`ConfirmationBanner.tsx`).
- Popup de agradecimiento con compartir tras confirmar: fondo sage, tarjeta de 440 px, esquinas de 20–24 px (`ConfirmedSharePopup.tsx`).
  La pantalla de confirmar **no lo duplica**: redirige a la landing, donde ese popup ya aparece con `?confirmada=1`.
