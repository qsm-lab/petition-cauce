# Prompt para Claude Design

Pega esto en Claude Design y adjunta `brief.md`, `tokens.md` y `referencia/embudo-post-firma.design-export.html`.

---

Diseña la pantalla `/confirmar/<token>` de una plataforma de firmas para campañas ambientales en Ecuador. Es la pantalla a la que llega una
persona al tocar el botón «Confirmar mi firma →» de su correo. Tiene **una sola acción**: un botón que confirma la firma. Existe para que los
programas automáticos de correo (que abren los enlaces solos) no confirmen firmas que nadie confirmó.

**Entrega un único HTML autocontenido** con un marco etiquetado por estado, igual que el export de referencia adjunto (marcos con
`frame-label` y notas `spec-note` que explican qué dispara cada estado). Responsivo de verdad, **móvil primero (360–390 px)**, con el estado
inicial también a 1160 px.

**Estados (todos):**
1. **Antes** — título «Confirma tu firma», una frase, botón principal «Confirmar mi firma», nota de por qué hay un paso más, «Si no fuiste tú, cierra esta página» y enlace al aviso de privacidad.
2. **Enviando** — botón deshabilitado con indicador y «Confirmando…», sin saltos de layout.
3. **Éxito** — marca de verificación animada, «¡Firma confirmada!», «Te llevamos a la campaña…» y botón «Ir a la campaña» visible.
4. **Vencido** — icono ámbar, «Este enlace venció», «Los enlaces duran 24 horas», botón «Volver a la campaña».
5. **No válido** — «Este enlace no es válido», mensaje neutro que no distingue «no existe» de «ya usado», botón «Ir al inicio».
6. **Error al confirmar** — «No pudimos confirmar ahora», botón «Reintentar».

**Restricciones de contenido:** antes del clic la página **no conoce** ni el nombre de la campaña ni el de la persona, así que no los muestres. No muestres
el token, el correo ni la cédula. Sin menú de navegación (solo un encabezado mínimo con el wordmark de la plataforma). Sin ilustraciones pesadas
ni imágenes de terceros; iconos en SVG inline. Sin seguimiento ni formularios. Tono cercano con tuteo.

**Estilo:** usa exactamente los tokens y el botón principal de `tokens.md` (fondo sage `#EDF4F1`, tarjeta blanca de 16 px y máximo 440 px,
botón lime `#D7F24C` con borde tinta `#16261F`, fuentes Anton y Work Sans). Define los tokens como variables CSS en `:root`.
Anima con `pc-pop` y `pc-spin` (descritos en `tokens.md`) y respeta `prefers-reduced-motion`.

**Accesibilidad:** objetivo táctil ≥ 48 px, contraste ≥ 4,5:1, foco visible, `role="status"` / `aria-live="polite"` en los cambios de estado, `aria-busy` al enviar.

**Decisiones abiertas, propón tu mejor opción y márcala en una nota:** (a) si mostrar la campaña antes del clic (recomiendo que no); (b) redirección
automática a los 1,5 s tras el éxito con el botón visible, o solo botón.

Comenta con una línea cada medida no obvia (espaciado, tamaño de fuente) para poder traducirla a Tailwind sin adivinar.
