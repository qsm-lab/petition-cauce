# Diseño del paso «Verifica tu información» para Claude Design (S1)

Feature: `revision-datos-al-firmar` (spec en `specs/revision-datos-al-firmar/`). Pantalla nueva dentro del diálogo de firma: aparece **después de «Firmar»** en el formulario y **antes de enviar**.

| Archivo | Para qué sirve |
|---|---|
| [`prompt-claude-design.md`](prompt-claude-design.md) | Texto para pegar en Claude Design. Empieza por aquí. |
| [`brief.md`](brief.md) | Qué es, a quién le habla, los estados, textos, accesibilidad y qué no hacer. |
| `../diseno-confirmar-firma/tokens.md` | Colores, tipografías, radios, sombras y botón principal (los mismos de la landing). |
| `../diseno-confirmar-firma/referencia/embudo-post-firma.design-export.html` | Formato de entrega esperado y estilo del diálogo (marcos etiquetados). |

## Cómo usarlo
1. Pega `prompt-claude-design.md` en Claude Design y adjunta `brief.md`, `tokens.md` y el HTML de referencia.
2. Pide **un solo HTML autocontenido** con todos los estados, como en la referencia.
3. Guarda el export en `specs/revision-datos-al-firmar/design-export.html` y avísame; lo reviso contra el brief y, con tu aprobación, implemento S4 en Tailwind.

Reglas del proyecto: sin diseño aprobado no se implementa; el HTML se traduce a Tailwind; las fuentes se auto-hospedan en build.
