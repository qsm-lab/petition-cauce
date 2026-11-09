# Correo de confirmación (desde donde llega la persona)

Fuente: `apps/api/app/services/email_service.py` (`send_confirmation_email`). La pantalla debe sentirse la continuación de este correo.

- **Asunto:** «Confirma tu firma: {título de la campaña}»
- **Encabezado:** «Confirma tu firma»
- **Cuerpo:** «Gracias por apoyar **{campaña}**. Haz clic en el botón para activar tu firma. El enlace es válido por 24 horas.»
  Seguido de un resumen de lo que la persona escribió (con el correo omitido y la cédula y el celular enmascarados), lo que implica su
  visibilidad elegida (pública, anónima o secreta) y el aviso de privacidad.
- **Botón:** «Confirmar mi firma →»
- **Pie:** «¿Algo está mal? Corregir mis datos» (si aplica) y «Si no solicitaste esta acción, ignora este mensaje. Tu firma no quedará registrada.»
- Lleva el logo y el nombre de la organización de la campaña, con el estilo propio de la plataforma (verde de acento `#3d6b35`).

Coherencia pedida a la pantalla:
- Mismo verbo y mismo texto del botón: «Confirmar mi firma».
- Misma promesa: si no fuiste tú, no pasa nada y la firma no queda registrada.
- Misma validez: 24 horas.
