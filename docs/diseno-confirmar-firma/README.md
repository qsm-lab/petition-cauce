# Diseño de `/confirmar/<token>` para Claude Design (V2 → V4)

Paquete para llevar a Claude Design. Feature: `verificacion-confirmacion-privacidad`, tareas **V2** (diseño) y **V4** (página en Next).

## Qué hay aquí
| Archivo | Para qué sirve |
|---|---|
| [`prompt-claude-design.md`](prompt-claude-design.md) | **Texto para pegar** en Claude Design. Empieza por aquí. |
| [`brief.md`](brief.md) | Qué es la pantalla, a quién le habla, los 6 estados, textos, accesibilidad y qué no hacer. |
| [`tokens.md`](tokens.md) | Colores, tipografías, radios, sombras, animaciones y estilo del botón principal (todo lo que ya usa la landing). |
| [`contrato-api.md`](contrato-api.md) | Qué hace la página con la API y a dónde redirige (para que el diseño no prometa nada que el sistema no haga). |
| [`referencia/email-confirmacion.md`](referencia/email-confirmacion.md) | El correo desde el que llega la persona (el diseño debe sentirse su continuación). |
| [`referencia/embudo-post-firma.design-export.html`](referencia/embudo-post-firma.design-export.html) | Un export anterior de Claude Design: el formato de entrega que se espera (marcos etiquetados, notas de especificación). |

## Cómo usarlo
1. Abre Claude Design y pega el contenido de `prompt-claude-design.md`.
2. Adjunta `brief.md`, `tokens.md` y el HTML de referencia (o pega su contenido si no admite archivos).
3. Pide **un solo HTML autocontenido** con todos los estados, como en la referencia.
4. Guarda el export en `specs/verificacion-confirmacion-privacidad/design-export.html` y avísame: lo reviso contra el brief y, con tu aprobación, implemento V4 en Tailwind.

## Reglas del proyecto que aplican (CLAUDE.md)
- Ninguna pantalla nueva se implementa sin diseño aprobado en Claude Design.
- El HTML exportado se traduce a clases Tailwind; no se embebe CSS inline en producción.
- Fuentes auto-hospedadas en build (`next/font`); no se cargan desde CDN en producción. En el HTML de diseño sí se pueden enlazar Google Fonts, como en los exports anteriores.

## Decisiones abiertas (marcadas en el brief)
1. ¿Mostrar el nombre de la campaña antes del clic? **Recomendación: no** (exigiría un endpoint nuevo y revelaría si el token existe).
2. ¿Redirección automática tras confirmar o botón manual? **Recomendación: automática en ~1,5 s con el botón visible.**

Estado: pendiente del diseño (V2). V3 (API) está hecha pero **no se despliega sin V4**: el `GET` del correo redirige a esta página.
