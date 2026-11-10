# Requirements — revision-datos-al-firmar

Origen: hallazgo de V8 (9 nov 2026). El correo de confirmación enviaba nombre completo, organización, cédula y celular enmascarados y provincia
(`derechos-arco` R19), pero el RAT y la cláusula del contrato declaran que a los proveedores de correo llegan **solo el correo y el primer nombre**
(`app/legal/subencargados.py`, `DATOS_COMUNICADOS`). Decisión del usuario: el correo vuelve a llevar solo el nombre; la revisión de datos se mueve
**al momento de firmar**, en un segundo paso previo al envío. Esta feature **sustituye a R19** de `derechos-arco`.

## Requisitos (EARS)

### Correo de confirmación
- **R1** El correo de confirmación NO DEBERÁ incluir resumen de datos del firmante: ni nombre completo, ni organización, ni cédula (completa o enmascarada),
  ni celular, ni provincia o país. Solo el saludo con el primer nombre (`signer_name.simple_name`), el botón de confirmar, el aviso de privacidad y los avisos fijos.
- **R2** SI la firma es pública, ENTONCES el correo DEBERÁ decir que el nombre aparecerá en el listado público y en el documento de entrega, sin repetir el nombre
  más allá del saludo; SI es anónima o secreta, NO DEBERÁ mencionar el listado.
- **R3** El enlace «Corregir mis datos» (portal ARCO, R15 de `derechos-arco`) DEBERÁ conservarse sin cambios, ya que no contiene datos personales (solo un token).

### Revisión al firmar (frontend)
- **R4** CUANDO la persona pulse «Firmar» y el formulario sea válido, el sistema DEBERÁ mostrar un segundo paso (popup) con el título «Verifica que tu información sea correcta»
  (o equivalente aprobado en el diseño) y el resumen de **todo lo que viajará al servidor**, según lo que la campaña pida (`form_config`):
  tipo de firmante («Firma como», siempre), organización (tipo «organización»), nombre y apellido, correo completo, ubicación (provincia si es nacional; país si es
  internacional), documento de identidad (cédula si es nacional; número de identificación si es internacional), celular (si la campaña lo solicita), visibilidad elegida con su
  significado, y la aceptación del aviso de privacidad (con enlace). Los campos que la campaña **pide** y la persona dejó vacíos aparecen como «No indicado»; los que la campaña
  **no pide** no aparecen.
- **R4b (cobertura garantizada)** El resumen DEBERÁ construirse a partir del mismo objeto que se envía en la firma, no de una lista aparte; un test DEBERÁ recorrer las claves de ese
  objeto (salvo token anti-bot, consentimiento y suscripción) y comprobar que cada una con valor aparece en el resumen, para que un campo nuevo no pueda quedar fuera sin que falle.
- **R5** El paso de revisión DEBERÁ ofrecer dos acciones: «Firmar» (envía la firma) y «Editar datos» (vuelve al formulario con todos los valores, el consentimiento y la visibilidad
  conservados, sin volver a pedirlos).
- **R6** Antes de pulsar «Firmar» en la revisión, el sistema NO DEBERÁ hacer ninguna petición con los datos del formulario ni guardarlos en `localStorage`, `sessionStorage`,
  cookies ni URL. Si la persona cierra el diálogo, los datos se descartan como hoy.
- **R7** El correo DEBERÁ mostrarse completo y destacado en la revisión (un correo mal escrito es la causa más probable de una firma que nunca se confirma).
- **R8** CUANDO el token de Turnstile haya caducado o falte al pulsar «Firmar» en la revisión, el sistema DEBERÁ obtener uno nuevo sin pedir de nuevo los datos
  y sin sacar a la persona de la revisión; si la verificación falla, DEBERÁ mostrar el paso de error existente con la opción de reintentar.
- **R9** El botón «Firmar» DEBERÁ bloquearse tras el primer clic (sin doble envío) y mostrar el estado de envío existente.
- **R10** El paso DEBERÁ cumplir accesibilidad: el foco pasa al título al entrar, el orden de tabulación es lógico, «Editar datos» devuelve el foco al primer campo con error
  o al primer campo, los botones miden ≥ 44 px, y no hay desbordamiento horizontal a 360 px.
- **R11** Los valores mostrados NO DEBERÁN enviarse a registros ni analítica (`/track`).

### Verificación
- **R12** Los tests de la API DEBERÁN cubrir que el cuerpo HTML y el texto plano del correo de confirmación no contienen nombre completo, organización, cédula, celular ni ubicación
  (guardia del RAT), con y sin firma pública.
- **R13** Una prueba en navegador DEBERÁ cubrir: revisión → «Editar datos» (valores conservados) → «Firmar» (una sola petición, con los valores corregidos) y token de Turnstile caducado.

### Nombre y apellido separados (decisión del usuario, 10 nov)
- **R14** El formulario DEBERÁ pedir **Nombre(s)** y **Apellido(s)** en dos campos (para persona y para el contacto de una organización); cuando la campaña exija el nombre, DEBERÁ exigir ambos.
- **R15** La API DEBERÁ aceptar `first_name` y `last_name` y guardar ambos, y DEBERÁ seguir guardando `name` como el nombre completo compuesto (`first_name` + espacio + `last_name`), de modo que
  el listado público, el export, ARCO y las comunicaciones no cambien. Una firma enviada solo con `name` (página en caché de un cliente anterior) DEBERÁ seguir aceptándose durante la transición.
- **R16** Los correos DEBERÁN usar únicamente `first_name` (primera palabra, con la lógica de `simple_name`); SI no existe (firmas anteriores), ENTONCES `simple_name(name)`. El apellido NO DEBERÁ
  pasarse a ninguna función de envío ni a las etiquetas de comunicaciones.
- **R17** La anonimización por retención, la supresión ARCO y la anulación DEBERÁN borrar también `first_name` y `last_name`. La rectificación de nombre en el portal ARCO DEBERÁ actualizar `name` y
  poner `first_name`/`last_name` en NULL (queda el respaldo `simple_name(name)`); separar el portal en dos campos queda para una iteración posterior.
- **R18** El resumen del popup DEBERÁ mostrar Nombre y Apellido en filas separadas. La validación (longitud máxima 120 cada uno, sin espacios sobrantes, no vacíos) DEBERÁ aplicarse en el
  formulario y en la API.
- **R19** Las firmas anteriores NO se migran (no se puede separar de forma fiable); sus columnas nuevas quedan en NULL.

### Paso «Revisa tu correo» (decisión del usuario, 10 nov) — sustituye a «Ya confirmé — continuar»
Hoy, tras firmar, `StepSuccess` muestra «Ya confirmé — continuar»: la gente lo pulsa sin haber confirmado y se confunde. Se cambia por una ayuda para llegar al correo y un avance automático.
- **R20** El botón «Ya confirmé — continuar» DEBERÁ eliminarse.
- **R21** SI el dominio del correo es de un servicio web reconocido, ENTONCES el paso DEBERÁ mostrar un botón principal «Abrir <servicio>» que abra la bandeja en una pestaña nueva
  (`target="_blank"`, `rel="noopener noreferrer"`), sin incluir el correo de la persona en la URL. Servicios reconocidos (dominio exacto, sin distinguir mayúsculas):
  Gmail (`gmail.com`, `googlemail.com`), Outlook (`outlook.com`, `outlook.es`, `hotmail.com`, `hotmail.es`, `live.com`, `msn.com`), Yahoo (`yahoo.com`, `yahoo.es`, `ymail.com`),
  iCloud (`icloud.com`, `me.com`, `mac.com`) y Proton (`proton.me`, `protonmail.com`, `pm.me`).
- **R22** SI el dominio no está reconocido (dominio propio, institucional, u otro), ENTONCES NO DEBERÁ mostrarse un botón de apertura, y el botón «Reenviar correo de confirmación» DEBERÁ ser la acción principal.
- **R23** El aviso de revisar la carpeta de spam DEBERÁ ser claramente más notorio que hoy (contraste y énfasis propios de una advertencia, no el recuadro gris secundario) y mencionar spam o correo no deseado
  y la vigencia de 24 horas; con dominio no reconocido DEBERÁ ser aún más destacado.
- **R24** Transcurridos **10 s** sin interacción, el paso DEBERÁ cerrarse solo y mostrar el popup de compartir existente (`StepThanks`), sin contador (R27). El tiempo restante DEBERÁ ser visible
  (indicador de cuenta atrás que respete `prefers-reduced-motion`) y el avance NO DEBERÁ anunciarse en cada segundo a lectores de pantalla (un único aviso).
- **R25** (WCAG 2.2.1) La persona DEBERÁ poder detener el avance automático («Seguir aquí»); reenviar el correo DEBERÁ reiniciar los 10 s; abrir la bandeja no lo detiene.
- **R26** «Reenviar» DEBERÁ reflejar el resultado real: éxito → «Correo reenviado ✓»; 429 o fallo → mensaje claro («Espere un minuto…» / «No pudimos reenviarlo»). Hoy `resendConfirmation` devuelve `false`
  y la interfaz igual muestra «reenviado» (límite del servidor: 3 por minuto).
- **R27** El popup que aparece **al avanzar solo** (`StepThanks`, firma aún pendiente de confirmar) NO DEBERÁ mostrar el contador de firmas ni consultarlo. Queda con agradecimiento, la indicación de que falta
  confirmar desde el correo y las opciones de compartir. (Decisión del usuario, 10 nov.)
- **R27b** El popup que aparece **al confirmar desde el correo** (`ConfirmedSharePopup`, `/c/<slug>?confirmada=1`) DEBERÁ mostrar el contador («N firmas» y, si la campaña tiene meta, «de M» con barra de avance),
  con el valor `signature_count` (firmas confirmadas) de la propia campaña, el mismo que muestra la landing. El contador NO DEBERÁ afirmar «eres la firma N»: el valor sale de la caché pública
  (se refresca cada ≈ 10 s) y puede ir uno o más por detrás; el texto DEBERÁ decir «hasta el momento».
- **R29** La «✕» DEBERÁ cerrar el diálogo como hoy, sin pasar por el popup de compartir.
- **R30** Pruebas: el mapa de dominios (con mayúsculas, subdominios no reconocidos y dominios parecidos como `gmail.com.ec`, que NO coincide), la cuenta atrás de 10 s, pausa y reinicio, la transición con y sin contador,
  y el flujo de reenviar con 204 y 429, en una prueba de navegador.

## Fuera de alcance
- Cambiar el texto del consentimiento, el flujo de `mis-datos` o el portal ARCO.
- Cambiar qué datos pide cada campaña (`form_config`); solo cambia cómo se captura el nombre.
- Separar nombre y apellido en el portal de `mis-datos` y en el panel de administración (solo se garantiza que no se rompan; R17).
- Declaraciones del RAT y del contrato: **no cambian**; con R1 vuelven a ser ciertas.
