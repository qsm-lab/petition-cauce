# Brief — pantalla `/confirmar/<token>`

## 1. Qué es y por qué existe
Pantalla puente entre el **botón del correo de confirmación** y la **landing de la campaña**. La persona firmó hace unos minutos
y recibió un correo con «Confirmar mi firma →». Antes, ese enlace confirmaba al abrirse. Los programas que revisan enlaces
(Outlook Safe Links, Gmail, antivirus de empresa) lo abrían solos y confirmaban firmas que nadie había confirmado. Ahora el
enlace abre esta pantalla y **solo el botón** confirma. Un programa automático no pulsa botones.

Es una pantalla de **una sola acción**. Debe ser rápida, tranquila y obvia.

## 2. A quién le habla
- Persona que apoya una campaña ambiental en Ecuador (consulta, defensa de territorio).
- Casi siempre en el **móvil**, venida del correo o de WhatsApp. Diseñar primero a **360–390 px** de ancho.
- No conoce la plataforma «Cauce»: conoce la campaña. Quiere terminar en un toque y volver a lo suyo.
- Tono: cercano y claro, **tuteo** («confirma», «tu firma»). Sin jerga técnica, sin voseo.

## 3. Ruta y datos disponibles
- Ruta: `/confirmar/<token>`. El token es opaco y **nunca se muestra** en pantalla.
- **Antes del clic la página no sabe nada de la campaña ni de la persona.** No hay nombre de campaña, ni nombre, ni correo.
  (Mostrarlos exigiría un endpoint que revele si el token existe. Decisión abierta 1: recomendación, no hacerlo.)
- Tras confirmar, la API devuelve el `slug` de la campaña y el nombre de quien firma (a V4 le toca decidir cuándo usarlo; ver `contrato-api.md`). Con eso la página redirige.
- Detalle del contrato en [`contrato-api.md`](contrato-api.md).

## 4. Estados a diseñar (todos, en un solo HTML)
| # | Estado | Cuándo | Qué ve la persona |
|---|---|---|---|
| 1 | **Antes** (por defecto) | Abrió el enlace | Título, una frase, botón principal «Confirmar mi firma», nota breve de por qué hay un clic más, enlace al aviso de privacidad. |
| 2 | **Enviando** | Pulsó el botón | Botón deshabilitado con indicador de carga y texto «Confirmando…». Sin saltos de layout. |
| 3 | **Éxito** | `status: confirmed` (también si ya estaba confirmada: es idempotente) | Marca de verificación animada, «¡Firma confirmada!», aviso «Te llevamos a la campaña…» y botón «Ir a la campaña» visible por si la redirección tarda o falla. |
| 4 | **Vencido** | `status: expired` (el enlace dura 24 h) | Icono de aviso (ámbar), «Este enlace venció», una línea de explicación y un botón «Volver a la campaña» para firmar de nuevo. |
| 5 | **No válido** | `status: invalid` (token desconocido, incompleto o ya reemplazado) | «Este enlace no es válido». Mensaje neutro que **no distingue** entre «no existe» y «ya usado». Botón secundario «Ir al inicio». |
| 6 | **Error al confirmar** | Fallo de red, límite de intentos (429) o error del servidor | «No pudimos confirmar ahora», «Inténtalo de nuevo en unos segundos» y botón «Reintentar». El enlace sigue siendo válido. |

Vistas requeridas: el estado 1 en **móvil (375 px) y escritorio (1160 px)**; los estados 2–6 al menos en móvil.

## 5. Textos propuestos (editables por el diseño; mantener el significado)
- **Antes:** título «Confirma tu firma». Cuerpo «Un toque más y tu firma queda registrada en la campaña.» Botón «Confirmar mi firma».
  Nota: «Pedimos este paso para que ningún programa automático de tu correo confirme por ti.»
  Pie: «Si no fuiste tú, cierra esta página: tu firma no quedará registrada.» + enlace «Aviso de privacidad».
- **Enviando:** «Confirmando…»
- **Éxito:** «¡Firma confirmada!» · «Gracias por sumar tu voz. Te llevamos a la campaña…» · botón «Ir a la campaña».
  Con nombre disponible: «¡Gracias, {Nombre}!» (solo el primer nombre). Debe existir también la versión sin nombre.
- **Vencido:** «Este enlace venció» · «Los enlaces de confirmación duran 24 horas. Vuelve a la campaña y firma de nuevo para recibir uno nuevo.» · botón «Volver a la campaña».
- **No válido:** «Este enlace no es válido» · «Puede que esté incompleto o que ya lo hayas usado. Si aún no confirmaste, firma de nuevo desde la campaña.» · botón «Ir al inicio».
- **Error:** «No pudimos confirmar ahora» · «Revisa tu conexión e inténtalo de nuevo.» · botón «Reintentar».

## 6. Marca y estilo
- Mismo lenguaje visual de la landing (fondo sage, tarjeta blanca, botón lime con borde tinta). Ver [`tokens.md`](tokens.md).
- Un **wordmark o encabezado mínimo** de la plataforma arriba (sin menú, sin enlaces de navegación: la pantalla no debe distraer).
- Esta página **no pertenece a una campaña concreta**, así que usa los tokens por defecto (Bosque), no los de ninguna campaña.
- Tarjeta centrada, ancho máximo ≈ 440 px, esquinas de 16 px; en móvil la tarjeta puede ocupar casi todo el ancho.
- Sin ilustraciones pesadas ni imágenes de terceros. Iconos en SVG inline.

## 7. Accesibilidad y comportamiento
- Objetivo táctil del botón ≥ 48 px de alto; ancho completo en móvil.
- Contraste de texto ≥ 4,5:1 (la tinta `#16261F` sobre lime `#D7F24C` ya cumple).
- Los cambios de estado se anuncian con `role="status"` / `aria-live="polite"`; el botón usa `aria-busy` mientras envía.
- Foco visible en todos los controles; el botón no pierde el foco al pasar a «Enviando».
- Respeta `prefers-reduced-motion` (la animación del check se reduce; la redirección sigue funcionando).
- Si JavaScript está desactivado: un aviso «Activa JavaScript para confirmar tu firma» (la confirmación necesita un `POST`).
- Evitar doble envío: tras el primer clic el botón queda deshabilitado.

## 8. Qué NO debe aparecer ni hacer
- No mostrar el token, el correo, la cédula ni el nombre completo.
- No cargar scripts ni fuentes de terceros en producción (las fuentes se auto-hospedan; ver README).
- No añadir seguimiento, píxeles ni analítica en esta pantalla.
- No añadir Turnstile ni formularios: la acción es un solo botón (el servidor limita a 20 intentos por minuto).
- No ofrecer «reenviar el correo» aquí: la página no conoce el correo de la persona.
- No usar el color lime como texto sobre fondo claro (no contrasta).

## 9. Entregable esperado
**Un HTML autocontenido** (como [`referencia/embudo-post-firma.design-export.html`](referencia/embudo-post-firma.design-export.html)):
- Un marco etiquetado por estado (`frame-label`) con una nota de especificación (`spec-note`) que diga qué dispara ese estado.
- Variables CSS con los tokens de `tokens.md` en `:root`, y los colores de estado (`--ok`, `--danger`, `--amber`) del export anterior.
- Un comentario por cada medida no obvia (espaciados, tamaños de fuente) para traducirla a Tailwind sin adivinar.
- Responsivo de verdad (no solo dos maquetas fijas), probado a 360, 390 y 1160 px.

## 10. Decisiones abiertas (el diseño puede proponer, el usuario decide)
1. **Nombre de la campaña antes del clic:** recomendación **no**. Si se quisiera, hay que añadir un endpoint de lectura que no confirme.
2. **Redirección tras el éxito:** recomendación automática a los ~1,5 s con el botón visible (el destino es `/c/<slug>?confirmada=1&nombre=<Nombre>`, donde ya existe el popup de compartir).
3. **Vencido:** el destino del botón es `/c/<slug>?confirmada=expirada`, donde la landing ya muestra el aviso de enlace vencido.
