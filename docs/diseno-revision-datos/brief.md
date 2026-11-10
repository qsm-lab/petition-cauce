# Brief — paso «Verifica tu información»

## Qué es y cuándo aparece
Dentro del diálogo «Firmar esta petición» (mismo marco, mismo ancho y misma cabecera que el formulario). La persona completó el formulario y pulsó **Firmar**.
Antes de enviar nada, ve un resumen de lo que escribió para detectar errores de tipeo (sobre todo del **correo**: si está mal, nunca recibirá el enlace de confirmación).
**No se ha enviado ni guardado nada todavía.** Es un paso de lectura con dos salidas.

## A quién le habla
Persona de a pie, en el celular, a menudo con prisa o con poca práctica en formularios. Tono cercano, respetuoso y en «usted» como el resto del formulario. Sin jerga legal.

## Contenido
**Título:** «Verifica que tu información sea correcta» (o «Revise que sus datos estén correctos», para concordar con el «usted» del formulario; elegir uno y mantenerlo).
**Subtítulo corto:** «Aún no hemos enviado nada. Si algo está mal, edítelo ahora.»

**Filas del resumen** (etiqueta pequeña + valor; solo se muestran las que aplican):
| Fila | Se muestra si | Nota de diseño |
|---|---|---|
| Firmas como | siempre | «Persona» u «Organización» |
| Nombre | siempre | fila propia |
| Apellido | siempre | fila propia (el formulario pasa a pedir Nombre(s) y Apellido(s) por separado) |
| Documento | siempre que se pidió | «Cédula» (nacional) o «Número de identificación» (internacional) |
| Aviso de privacidad | siempre | «Aceptó el aviso de privacidad» + enlace |
| Organización | tipo = organización | |
| **Correo** | siempre | **Destacado** (más grande o con fondo): es el dato crítico; mostrar completo y sin cortar (`overflow-wrap:anywhere`) |
| Cédula | se pidió | completa; «No indicado» si se dejó vacía |
| Celular | la campaña lo solicita | completo; «No indicado» si se dejó vacío |
| Ubicación | siempre | provincia o país |
| Visibilidad | siempre | etiqueta (Pública / Anónima / Secreta) + una línea con su significado (misma frase del formulario) |

Una línea de pie: «Le enviaremos un correo para confirmar su firma.»

**Botones** (apilados en móvil, lado a lado en escritorio):
- **Firmar** (primario, el mismo estilo del botón principal del formulario).
- **Editar datos** (secundario, visualmente menor; vuelve al formulario con todo conservado).

## También hay que rediseñar el campo del nombre en el formulario
El formulario pasa de un campo «Nombre y apellido» a dos: **Nombre(s)** y **Apellido(s)** (en móvil apilados; en escritorio, lado a lado). Mismo estilo de campo, error y foco que los demás. Incluir un marco del formulario con los dos campos y otro con el error «Falta el apellido».

## Estados a diseñar (marcos etiquetados)
1. **Revisión** (móvil 390 px y escritorio 1160 px).
2. **Variantes por campaña:** con organización (fila extra); internacional (país y número de identificación); con celular; y con cédula/celular vacíos («No indicado»).
3. **Valor largo** (correo de 45 caracteres, nombre de 60) sin desbordar.
4. **Enviando** (el botón «Firmar» bloqueado con indicador; es el estado de envío ya existente, solo mostrar cómo se ve el botón).
5. **Verificando** (token anti-bot aún no listo: el botón «Firmar» con «Verificando…», bloqueado ≤ 5 s).
6. **Foco/teclado:** anillo de foco visible en ambos botones.

## Accesibilidad
- El foco pasa al título al entrar; título con `tabindex="-1"`.
- Lista de definiciones (`dl`) semántica para el resumen; el correo con `inputmode`/no editable.
- Botones ≥ 44 px; contraste AA; sin desbordamiento horizontal a 360 px.
- `aria-live="polite"` para «Verificando…» y errores.

## Qué NO hacer
- No mostrar campos editables en este paso (editar = volver al formulario).
- No introducir casillas nuevas ni textos legales nuevos; el consentimiento ya se dio en el formulario.
- No sugerir que los datos ya se enviaron o guardaron.
- No usar CSS inline para producción; el HTML se traduce a Tailwind (en el diseño sí puede usarse CSS).

## Decisiones abiertas (marcar en el diseño)
1. ¿El resumen va en tarjeta única o en filas separadas por líneas finas? Recomendación: **filas con líneas finas**, el correo con fondo suave.
2. ¿«Esc» cierra todo el diálogo o vuelve al formulario? Recomendación: **vuelve al formulario** (el cierre explícito queda en la cabecera).

---

# Segunda pantalla: «Revisa tu correo» (sustituye a «Ya confirmé — continuar») y copia del popup de compartir

## Problema
Tras firmar, la persona ve «Ya confirmé — continuar» y lo pulsa sin haber confirmado. Se elimina. En su lugar: ayudarle a llegar al correo y avanzar solo al popup de compartir.

## Variantes (marcos)
1. **Correo de un servicio reconocido** (Gmail, Outlook/Hotmail, Yahoo, iCloud, Proton): botón principal **«Abrir Gmail»** (o el servicio que sea; en pestaña nueva), botón secundario «Reenviar correo de confirmación», aviso de spam.
2. **Dominio propio o no reconocido:** sin botón de abrir; **«Reenviar correo de confirmación» pasa a ser la acción principal**; aviso de spam **aún más destacado**.
3. **Reenviando / reenviado ✓ / error** (429: «Espere un minuto y vuelva a intentarlo»; fallo: «No pudimos reenviarlo»).
4. **Cuenta atrás:** indicador visible de 10 s («Continuamos en 10 s») + enlace **«Seguir aquí»** que lo detiene (accesibilidad). Debe respetar `prefers-reduced-motion`. Reenviar reinicia la cuenta.

## Aviso de spam (más notorio)
Que se vea como advertencia, no como nota gris: ícono y color de advertencia (compatible con la paleta), texto más grande y en negrita la primera frase. Contenido: «Revise también la carpeta de **spam o correo no deseado**. El enlace vence en 24 horas.» En dominio propio, una línea extra: los correos de dominios propios a veces tardan o caen en spam.

## Dos popups de compartir (ya existen)
**A. Tras firmar, al avanzar solo (`StepThanks`, la firma aún está pendiente):** **sin contador**. Hoy dice «Tu firma quedó registrada. Acabás de mover el contador.» → no puede afirmar que
quedó confirmada: indicar que **falta confirmarla desde el correo**. Quitar el bloque del contador (número, «de M» y barra) y conservar agradecimiento y botones de compartir.

**B. Al confirmar desde el correo (`ConfirmedSharePopup`, `/c/<slug>?confirmada=1`):** **añadir el contador** entre el texto y el recuadro «Comparte esta campaña»:
número grande, «firmas hasta el momento» y, si la campaña tiene meta, «de M» con barra de avance (mismo estilo del bloque que se retira de A). Sin «eres la firma N». Ya tiene «¡Gracias, <nombre>! Tu firma quedó confirmada y ya suma.»

Unificar el trato en **«usted»** en ambos (hoy A mezcla «Tu»/«Acabás»). El nombre en mayúscula inicial (hoy sale «javier»).

## Datos para el diseño
- Nombre en el título: primer nombre con inicial en mayúscula («Javier, por favor, confirme su correo»).
- El correo se muestra completo y sin cortar.
- Botones ≥ 44 px; foco visible; sin desbordamiento a 360 px.
