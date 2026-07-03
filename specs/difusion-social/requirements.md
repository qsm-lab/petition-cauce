# Requirements — difusion-social

## Contexto
Sección de difusión en la landing pública para maximizar el alcance de cada campaña.

## Requisitos

**R1** — La landing muestra botones de compartir: WhatsApp (destacado), Telegram, Facebook, X (Twitter), Correo electrónico.

**R2** — WhatsApp va full-width como botón principal (color primario de campaña).

**R3** — Telegram va full-width outlined como segundo botón.

**R4** — Facebook, X y Correo van en fila de igual ancho como tercera fila.

**R5** — Cada botón genera la URL de compartir con el título de la campaña y la URL canónica.

**R6** — La URL canónica es: en producción, el dominio asignado a la campaña; en local, `/?slug=[slug]`.

**R7** — Hay un campo de URL copiable con botón "Copiar" que usa la Clipboard API.

**R8** — El texto de compartir incluye el título y la URL: `"[título] — firma aquí: [url]"`.

**R9** — En desktop, la sección aparece en el aside (sticky). En mobile, aparece al final del contenido principal.
