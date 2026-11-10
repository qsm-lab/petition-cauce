# Preparación de V6–V10 (verificacion-confirmacion-privacidad)

Material preparado el 9 nov 2026 **sin tomar decisiones**: tablas para rellenar, comprobaciones con su método, y los hechos
verificados en el código y en `docs/legal/`. Lo que necesita decisión o revisión humana está marcado con ⏸.

---

## V6 · Buzones reales (R3) — tabla para rellenar

Método: con la campaña de prueba (`test-fresh`, hoy en `draft`: activarla solo durante la prueba), firmar con un correo de cada
proveedor; sin tocar nada, anotar dónde cae el mensaje y cómo se ve. Abrir el correo en el celular y en el escritorio.

| Buzón | Llega a | Tarda | Remitente y asunto se leen bien | Botón «Confirmar» visible | Enlace abre `/confirmar/<token>` | Notas |
|---|---|---|---|---|---|---|
| Gmail (web) | ☐ Entrada ☐ Promociones ☐ Spam | | ☐ | ☐ | ☐ | |
| Gmail (app Android/iOS) | | | ☐ | ☐ | ☐ | |
| Outlook / Hotmail | ☐ Entrada ☐ Correo no deseado | | ☐ | ☐ | ☐ | Suele marcar remitentes nuevos |
| iCloud | ☐ Entrada ☐ Spam | | ☐ | ☐ | ☐ | Privacidad de correo de Apple: ver V7 |
| Corporativo (Google Workspace / Microsoft 365) | | | ☐ | ☐ | ☐ | Puede tener escáner de enlaces |
| Yahoo (opcional) | | | ☐ | ☐ | ☐ | |

Comprobaciones extra:
- ☐ **Escáner de enlaces** (corporativo): tras recibir el correo **sin pulsar nada**, la firma debe seguir `pending_confirmation`
  (el GET solo redirige; es el objetivo de D1).
- ☐ Modo oscuro: el texto del correo se lee.
- ☐ Cabeceras (en Gmail: ⋮ → «Mostrar original»): SPF, DKIM y DMARC en `PASS`.

---

## V7 · Seguimiento de aperturas y clics (R5)

**Hechos verificados en el código y documentos (no hace falta volver a averiguarlos):**
- El código no genera pixel de seguimiento ni reescribe enlaces; los enlaces del correo apuntan directo a nuestro dominio.
- Los correos llevan `<img>` del logo de la organización (`email_service.py`, varias plantillas) y el QR va como `data:` URI (no es una petición).
  El logo es una petición a quien lo aloja: si está en nuestro dominio, la ven nuestros registros, no un tercero.
- **Brevo** inyecta un pixel de aperturas (`r.camp.ecuadornotlc.org/tr/op/…`) después de la API; verificado el 24 oct (`docs/legal/subencargados_email.md` §2).
  Cambiar el ajuste en la cuenta **no lo quitó** en dos pruebas. El RAT ya lo declara. ⏸ Decisión abierta: desactivarlo o aceptarlo.
- **Resend**: aperturas y clics se activan **por dominio** en su panel (por defecto, desactivados).
- **SES**: sin seguimiento salvo que se configure un *configuration set*.

**Qué comprobar y dónde (solo el panel y un correo real, ⏸ lo haces tú):**
1. Resend → *Domains* → `ecuadornotlc.org` → *Open tracking* y *Click tracking*: ☐ ambos desactivados.
2. Brevo → *Transactional* → *Settings* → *Tracking* (o *Email settings*): ☐ aperturas ☐ clics. Anotar si el plan permite desactivarlos.
3. Cuál proveedor envía el correo de **confirmación** en producción (`EMAIL_PROVIDER` y `EMAIL_POOL` del VPS; sin imprimir secretos):
   `ssh -t javofox@209.182.239.109 'cd <repo> && docker compose exec -T petition-api printenv EMAIL_PROVIDER EMAIL_POOL'`
4. Con un correo real: «Mostrar original» y buscar `<img` con `display:none` o 1×1, y `List-Unsubscribe`:
   `grep -oE '<img[^>]*(width="1"|display:none)[^>]*>'` sobre el original guardado como `.eml`.

---

## V8 · Aviso de privacidad y RAT (R4) — inventario frente a lo declarado

`apps/api/app/legal/subencargados.py` declara **solo** los proveedores de envío (Resend, Brevo, SES; EE. UU.). Lo que la plataforma
usa de verdad y **no aparece** en el RAT generado ni en `docs/legal/subencargados_email.md`:

| Proveedor / servicio | Qué ve | ¿Datos personales? | Ubicación | Declarado hoy |
|---|---|---|---|---|
| Cloudflare (proxy/CDN, caché, WAF) | Todo el tráfico HTTP del sitio: IP, URL, cuerpos de formularios al pasar | Sí (IP; el formulario de firma pasa en claro por su red) | Global | ❌ |
| Cloudflare Turnstile | IP y señales del navegador al firmar | Sí | Global | ❌ |
| Cloudflare R2 (UE) | Respaldos cifrados de la base | Sí, **cifrado** | UE | ❌ (ver pendiente de ciclo de vida) |
| Proveedor del VPS | Disco con la base y los archivos | Sí | ¿? ⏸ | ❌ |
| GreenGeeks (chequeo externo y SMTP de alertas) | Solo alertas operativas | No (verificar que las alertas no incluyan PII) | EE. UU. | ❌ (probablemente no requerido) |
| Resend / Brevo / SES | Email y primer nombre | Sí | EE. UU. | ✅ |

Pendientes que no puedo cerrar yo:
- ⏸ Confirmar con la organización Responsable cómo se redacta Cloudflare en el contrato de encargo (cláusula de subencargados) y qué país declarar.
- ⏸ País y proveedor del VPS (dato que no está en el repositorio).
- ⏸ Revisión legal del texto del aviso (`aviso_privacidad` es contenido por campaña, no código): finalidades reales, plazo de conservación y derechos.
- Cuando se decida, el cambio técnico es pequeño: ampliar `_PROVEEDORES` con una categoría de infraestructura (o una lista aparte) en `app/legal/subencargados.py` y que `rat.py`/`contrato_encargo.py` la rendericen.

---

## V9 · ARCO (R6)

Guion de recorrido de extremo a extremo (⏸ lo ejecuta una persona con un correo real y la campaña de prueba activa):
1. Firmar con correo propio y confirmar.
2. Abrir `/mis-datos`, pedir acceso con ese correo → llega el enlace de acceso.
3. En `/mis-datos/portal`: ver los datos, ☐ rectificar el nombre, ☐ oponerse/cancelar suscripción, ☐ solicitar supresión.
4. En el panel de administración: la solicitud figura, con plazo y responsable visibles; resolverla.
5. Comprobar que, tras la supresión, la firma queda anonimizada y el contador no cambia.

Definiciones que **faltan y son decisión del responsable** ⏸: persona responsable de atender ARCO, canal (correo), plazo de respuesta
(la LOPDP fija plazos legales; confirmar el que aplica), y qué dice el aviso. En el código ya están el flujo (`arco_service.py`) y `data_contact_email` por campaña.

---

## V10 · Retención de `pending_confirmation` (R7) — hechos y opciones

Hechos (`retention_service.py`, `specs/retencion-datos/requirements.md`):
- La retención usa `privacy_config.retention_days` (**por defecto 365**) y cuenta desde el evento `entrega` de la campaña; **si no hubo `entrega`, desde `created_at` de la firma**.
- No distingue por estado: una firma `pending_confirmation` (nunca confirmada) se conserva **hasta 365 días** desde que se creó, igual que una confirmada.
- Hoy las pendientes con token vencido (24 h) siguen contando en el total público (`total_count`) y se incluyen en exportes (`confirmed` + `pending_confirmation`).
- Al anonimizar se borran `name`, cédula, email cifrado, `ip_hmac` y `confirmation_token`; se conservan estado, provincia y fechas.

Opciones (⏸ decide el usuario o el responsable; no implemento ninguna):
| Opción | Qué implica | Costo |
|---|---|---|
| A. No cambiar | Pendientes viven hasta `retention_days`; documentarlo en el aviso | Ninguno; conserva datos de quien nunca confirmó |
| B. Plazo corto para pendientes (p. ej. 30–90 días) | Nuevo filtro en `retention_service` + campo o constante; `retention_days` sigue para confirmadas | Spec corta, migración opcional, tests |
| C. Purga tras vencer el token + periodo de gracia | Igual que B con plazo fijo | Spec corta |

Mi recomendación, a decidir: **B o C**, porque son datos de personas que no completaron el consentimiento (minimización). Decidir además si las pendientes
deben dejar de contar en el total público.
