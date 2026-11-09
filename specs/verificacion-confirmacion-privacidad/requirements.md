# verificacion-confirmacion-privacidad — Requisitos (EARS)

Origen: `hardening-campana` T5.7 (R12, R20), aprobada como verificación **mínima**: sin documentación exhaustiva.
Objetivo: comprobar con pruebas reales que la confirmación por correo funciona para quienes firman y que lo que
decimos en el aviso de privacidad coincide con lo que el sistema hace.

## Hallazgo previo
`GET /v1/public-campaign/confirm/{token}` **confirma la firma directamente** y conserva el token. Un escáner de enlaces
(Outlook Safe Links, Gmail, antivirus corporativos) que abra la URL antes que la persona confirma la firma sin intervención
humana. Efectos: tasa de confirmación inflada, consentimiento por correo verificado por una máquina, y cuentas que nunca
leyeron el correo marcadas como confirmadas.

## Requisitos
- **R1 — Escáneres de enlaces.** Cuando un escáner abre el enlace del correo, el sistema SHALL NOT confirmar la firma
  (ver decisión D1: confirmar solo tras una acción de la persona, p. ej. un botón que envía `POST`).
- **R2 — Confirmación rápida.** El sistema SHALL confirmar en menos de 5 s desde que la persona acciona el enlace (p95), medido
  en el entorno de carga y en producción con una firma de prueba.
- **R3 — Prueba en buzones reales.** Se SHALL verificar la llegada y el enlace en, al menos: Gmail, Outlook/Hotmail, iCloud y un
  correo corporativo; y registrar si cae en spam, si se reescribe el enlace y si el escáner lo abrió.
- **R4 — Aviso de privacidad veraz.** El aviso SHALL listar los proveedores que realmente tratan datos (Resend, Brevo, Cloudflare
  Turnstile, Cloudflare R2 UE como respaldo cifrado, el hosting del VPS) y su finalidad; SHALL coincidir con el RAT.
- **R5 — Sin seguimiento no declarado.** El sistema SHALL NOT incluir píxeles de apertura ni reescritura de enlaces con seguimiento
  en el correo de confirmación; si el plan de Brevo o Resend los activa por defecto, SHALL desactivarse y quedar verificado.
- **R6 — ARCO atendido.** El sistema SHALL tener definido quién atiende las solicitudes ARCO, por qué canal y en qué plazo, y
  el aviso SHALL decir lo mismo. La prueba SHALL recorrer el flujo `mis-datos` de extremo a extremo con una firma de prueba.
- **R7 — Retención de no confirmadas.** El proyecto SHALL decidir y documentar el plazo de conservación de firmas
  `pending_confirmation` (hoy 1 137 sin confirmar de la campaña cerrada, con datos personales).

## Fuera de alcance
Auditoría jurídica completa, rediseño del aviso, cambio de proveedores.
