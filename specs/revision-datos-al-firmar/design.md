# revision-datos-al-firmar — Diseño

## Decisiones
| # | Decisión | Elegida | Motivo |
|---|---|---|---|
| D1 | Qué datos sigue llevando el correo | **Solo primer nombre** (saludo) + frase de visibilidad si es pública | Hace verdadero el RAT sin cambiar contratos ni aviso |
| D2 | Dónde se revisa | **Paso 2 dentro del mismo diálogo de firma** (`SignFlow`), no un diálogo apilado | Una sola capa modal: foco, `Esc`, lector de pantalla y móvil son más simples |
| D3 | Cómo se conserva el formulario | **`StepForm` queda montado pero oculto (`hidden`/`inert`)** mientras se revisa | Conserva valores, validación y el widget de Turnstile (que renueva el token solo); «Editar datos» es solo cambiar de paso |
| D4 | Cédula y celular en pantalla | **Completos** (es la propia pantalla de la persona) | Para detectar errores de tipeo; la limitación de R1 aplica al correo, no a la pantalla |
| D6 | Cómo se separa el nombre | **Dos columnas nuevas nulas `first_name`, `last_name` y `name` se conserva como nombre completo compuesto** | Cero cambios en feed, export, ARCO y comunicaciones; el correo usa `first_name` sin heurística; las firmas viejas siguen funcionando |
| D7 | Qué es «solo nombre» para el correo | **Primera palabra de `first_name`** (`simple_name`) | Coherente con lo que ya declara el RAT («primer nombre»); si hubiera que mandar los dos nombres de pila (p. ej. «María José»), habría que cambiar la declaración |
| D8 | Cómo se reconoce el servicio de correo | **Mapa fijo de dominios exactos → URL de bandeja** en el frontend (R21); lo demás cuenta como dominio propio | Simple y sin llamadas externas; un correo de empresa en Microsoft 365 o Google Workspace queda como «no reconocido» (solo reenviar), que es el comportamiento pedido |
| D9 | Dónde abre cada botón | Gmail `https://mail.google.com/`, Outlook `https://outlook.live.com/mail/`, Yahoo `https://mail.yahoo.com/`, iCloud `https://www.icloud.com/mail`, Proton `https://mail.proton.me/` | Sin el correo en la URL. Con varias cuentas de Google, abre la cuenta por defecto (limitación conocida) |
| D10 | Avance automático | 10 s con cuenta atrás visible, «Seguir aquí» y reinicio al reenviar | Cumple el tiempo ajustable de accesibilidad (2.2.1) sin devolver el botón que confundía |
| D5 | Enlace «Corregir mis datos» del correo | **Se mantiene** (R3) | No lleva datos, sirve al derecho de rectificación tras firmar |

## Cobertura del resumen (R4, R4b)
Campos del formulario (`StepForm`/`FormValues`) y cuándo aparecen en la revisión:
| Campo | Aparece | Fila |
|---|---|---|
| `signer_type` | si la campaña admite más de un tipo, o es organización | Firmas como |
| `org_name` | tipo organización | Organización |
| `first_name`, `last_name` | siempre | Nombre · Apellido |
| `email` | siempre | Correo (destacado) |
| `location_mode` + `provincia` o `country` | siempre | Ubicación (provincia o país) |
| `cedula` | nacional: la campaña la pide; internacional: si se ingresó | Cédula / Número de identificación |
| `celular` | `request_celular` | Celular |
| `visibility` | siempre | Visibilidad + significado |
| `consent` | siempre | «Aceptó el aviso de privacidad» + enlace |
El componente recibe el mismo `FormValues` que se enviará y `formConfig`; el test de R4b recorre sus claves.

## Flujo
```
Formulario (paso 0) --Firmar (válido)--> Revisión (paso nuevo, sin red) --Firmar--> Enviando (1) --> Éxito (2) / Error (3)
        ^------------------------------- Editar datos ------------------------------|
```
`Step` pasa de números a una unión de cadenas (`"form" | "review" | "sending" | "success" | "error" | "thanks"`) para no renumerar.

## Archivos afectados
**API**
- `apps/api/app/services/email_service.py`: eliminar los parámetros `entered_*` y el bloque `review_block` de `send_confirmation_email` (texto plano y HTML).
- `apps/api/app/services/confirmation_email_service.py` (líneas ≈ 150–154): dejar de pasar `entered_*`; `_mask_cedula` y `_mask_phone` quedan sin uso en este módulo (borrar si nadie más los usa).
- `apps/api/tests/test_confirmation_email.py`, `test_confirmation_email_content.py`: actualizar y añadir la guardia de R12.

**API (separación de nombre, R14–R19)**
- Migración Alembic 043: `signatures.first_name VARCHAR(120) NULL`, `signatures.last_name VARCHAR(120) NULL` (producción está en 042). Sin cambios de RLS (misma tabla).
- `schemas/signature.py`: `first_name`/`last_name` opcionales; `name` pasa a opcional; validador: si hay los dos, `name` = compuesto; si solo hay `name`, se acepta (transición).
- `signature_service.create_signature`: guarda los tres.
- Quien arma los correos: pasar `sig.first_name or sig.name` como `signer_name` (confirmación, admin, ARCO, recuperación, comunicaciones `<nombre>`).
- `retention_service.anonymize_signature`, supresión y anulación en `arco_service.py` (≈ líneas 484, 537): anular también `first_name`/`last_name`; rectificación del portal: `first_name`/`last_name` = NULL.
- Tests: alta con y sin `first_name`/`last_name`, compatibilidad con `name`, anonimización, rectificación, que el correo no contenga el apellido.

**Web (paso «Revisa tu correo»)**
- `StepSuccess.tsx`: quitar `onContinue`; nuevas props `provider` (nombre y URL o `null`), `secondsLeft`, `onStay`; estado de reenvío con error; aviso de spam reforzado.
- `apps/web/src/lib/mail-providers.ts` (nuevo): mapa de dominios y `providerFor(email)` con su test.
- `SignFlow.tsx`: temporizador de 10 s en el paso de éxito (se limpia al desmontar; pausa/reinicio), `handleContinue` se llama al agotarse y ya no consulta el contador (R27); `onResend` usa el booleano que ya devuelve `resendConfirmation`.
- `StepThanks.tsx`: textos de R28; se quita el bloque del contador y la meta (y `getCampaignCount` deja de usarse desde `SignFlow`; borrar si no lo usa nadie más).
- `apps/web/src/app/(campaign)/components/ConfirmedSharePopup.tsx` + `apps/web/src/app/c/[slug]/page.tsx`: nuevas props `count` y `goal` (de `campaign.signature_count` y la meta) y bloque de contador igual al que se quita de `StepThanks` (R27b).
- Diseño aprobado (S14) antes de implementar.

**Web**
- `apps/web/src/components/sign-flow/SignFlow.tsx`: paso `review`; `StepForm` siempre montado; `onSubmit` del formulario pasa a la revisión; «Firmar» de la revisión llama a `handleSubmit`.
- `apps/web/src/components/sign-flow/StepReview.tsx` (nuevo): resumen + botones.
- `apps/web/src/components/sign-flow/StepForm.tsx`: dos campos (Nombre(s), Apellido(s)) en lugar de uno (`FormValues.first_name`/`last_name`); `onSubmit` ya recibe los valores; exponer cómo pedir un token nuevo si caducó (ver «Turnstile»).
- `specs/revision-datos-al-firmar/design-export.html` (diseño aprobado, **requisito previo**).

## Turnstile (R8)
El widget es «invisible» y vive en `StepForm`; renueva el token solo y lo vacía en `onExpire`. Al mantener el formulario montado (D3), el token se renueva incluso durante la revisión.
En «Firmar»: si `cf_turnstile_token` está vacío, esperar hasta ~5 s el siguiente `onVerify` (estado «Verificando…» en el botón); si no llega, paso de error con «Reintentar».

## Seguridad y LOPDP (`privacy_config`)
- **No hay tratamiento nuevo:** no se guarda ni se envía nada antes de «Firmar»; las finalidades, la base legal y el consentimiento no cambian. El efecto neto es **menos** datos hacia proveedores de correo.
- No se persiste el resumen en el navegador (R6); no entra en `/track` ni en registros (R11).
- El RAT/contrato no se modifican: `DATOS_COMUNICADOS` pasa a ser exacto (R1). La guardia R12 evita que vuelva a divergir.
- **`privacy_config` a aprobar:** «sin cambios de finalidad, base legal, plazo ni destinatarios; reducción de datos comunicados a proveedores de correo».

## Despliegue
El cambio de correo (R1–R3) y la pantalla (R4–R10) deben salir **juntos**: si el correo sale antes, se pierde la verificación hasta que llegue el popup. Una migración (043, columnas nulas): se aplica con el despliegue (`alembic upgrade head` ya está en `deploy.yml`) y es reversible. Orden seguro: API primero acepta ambos formatos; la web nueva envía `first_name`/`last_name`.
Los correos ya enviados con resumen siguen existiendo en los buzones; no hay forma de retirarlos.

## Revisión del diseño exportado (`design-export.html`, 10 nov) — condiciones para implementarlo
Cubre los 11 marcos pedidos (revisión móvil y escritorio, variantes de campaña, valores largos, enviando/verificando/foco, formulario con Nombre(s) y Apellido(s), «Revisa tu correo» con y sin servicio reconocido,
reenvío 204/429/fallo, cuenta atrás con «Seguir aquí» y movimiento reducido, y los dos popups de compartir). Cumple R4–R10, R20–R27b. Observaciones:
1. **Error de contenido (obligatorio corregir):** los textos de visibilidad del diseño no coinciden con los del formulario. En el diseño, *Secreta* dice «Solo se usa para el conteo y la entrega a la autoridad»;
   en el formulario (`VIS_HINTS`) dice que **no** se incluye en el documento de entrega. Al implementar se usan **los textos de `VIS_HINTS` tal cual** (Pública, Anónima y Secreta), nunca los del diseño.
2. **Enlace al aviso:** el diseño apunta a `/privacidad`; la ruta real es `/aviso-de-privacidad` (con el mismo `slug` que usa el enlace del formulario).
3. **Reconocimiento de dominios:** el diseño menciona comodines (`outlook.*`, `hotmail.*`, `live.*`, `yahoo.*`); la spec (R21) fija dominios exactos. Se implementa la lista exacta de R21 (ampliable con variantes regionales
   conocidas, p. ej. `hotmail.com.ar`, `live.com.mx`, `yahoo.com.mx`) y nunca coincidencia parcial.
4. **Títulos en mayúsculas:** el diseño pinta los títulos Anton en mayúsculas («JAVIER, POR FAVOR, CONFIRME SU CORREO»); los diálogos actuales los muestran en mayúscula inicial («¡Gracias, javier!»). ⏸ Confirmar cuál se quiere.
5. **Bloque de compartir:** el diseño simplifica los botones (texto, WhatsApp en lima). En producción se conservan el estilo e iconos actuales (WhatsApp oscuro, redondos para Facebook, X, correo y copiar); solo cambian textos y se añade/quita el contador.
6. **Cabecera del popup B:** el diseño añade la barra «Firma confirmada»; el popup actual solo tiene la «✕». ⏸ Confirmar si se quiere.
7. «Firma como» se muestra siempre (la spec decía solo con más de un tipo): se implementa como en el diseño.
8. **Aviso de spam en azul informativo** (no ámbar) con ícono de advertencia y primera frase en negrita; más notorio que hoy. ⏸ Confirmar que basta o si se prefiere ámbar.
9. Tras «Seguir aquí» el diseño ofrece «Ir a compartir la campaña» (honesto: no sugiere que ya confirmó). Se acepta.
