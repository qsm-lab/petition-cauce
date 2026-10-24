# Subencargados de envío de email

> Documento de trabajo (LOPDP, rol Encargado). Registra qué proveedores de email
> reciben datos personales de firmantes y las particularidades que afectan el RAT
> y los contratos de encargo. Actualizar al cambiar `EMAIL_PROVIDER` / `EMAIL_POOL`.

Última verificación: 2026-10-24 (sesión 44).

## 1. Proveedores

| Proveedor | Uso | Estado | Datos que recibe |
|-----------|-----|--------|------------------|
| Resend | Correos transaccionales y cola de comunicaciones (`EMAIL_PROVIDER=resend`, por defecto) | En producción | Email del destinatario, nombre (si va en el cuerpo), asunto y cuerpo del mensaje |
| Brevo | Segundo miembro del pool de la cola (`EMAIL_POOL=brevo,resend`) | Desplegado y probado (T8), envío masivo aún no programado | Igual que Resend, más datos de apertura (ver §2) |
| Amazon SES (us-east-2) | Alternativa por `EMAIL_PROVIDER=ses` | Configurado; cuenta en sandbox, sin acceso a producción | Igual que Resend |

Las organizaciones con `org_email_config` propia envían con sus credenciales y no
usan el pool; en ese caso el proveedor lo elige la organización Responsable.

## 2. Particularidades de Brevo (verificadas el 2026-10-24)

Dos correos de prueba enviados por la API transaccional v3, vistos en el
mensaje original recibido en Gmail:

1. **Pixel de seguimiento de aperturas.** El relay de Brevo inyecta en el HTML
   dos etiquetas `<img>` (una en un comentario condicional `[if mso]`, otra con
   `display:none`) que apuntan a `https://r.camp.ecuadornotlc.org/tr/op/...`.
   Nuestro código no lo genera: se agrega después de la API. Brevo registra por
   cada apertura la IP, la fecha y el cliente de correo del firmante.
   - El dominio del pixel es propio (`camp.ecuadornotlc.org`), pero lo sirve
     Brevo.
   - Un ajuste cambiado en la cuenta de Brevo **no lo quitó** en tres pruebas
     (la última, 2026-10-24 17:27 UTC). Puede estar en otra sección del panel,
     no haberse guardado, o no estar disponible en el plan; no está confirmado.
2. **Cabecera `List-Unsubscribe` de Brevo** (`List-Unsubscribe-Post:
   List-Unsubscribe=One-Click`), con un enlace de baja de Brevo. Quien la use
   queda en la lista de bloqueo de Brevo, no en la baja propia de la
   plataforma, por lo que no sustituye el flujo de oposición/ARCO. `EmailMessage`
   no tiene cabeceras, así que hoy no se puede enviar un `List-Unsubscribe` propio.
3. **Autenticación correcta.** SPF, DKIM (`ecuadornotlc.org`, selector `brevo2`)
   y DMARC en `pass` (política `p=NONE`); return-path `camp.ecuadornotlc.org`.

## 3. Impacto LOPDP

- Brevo y AWS son subencargados nuevos respecto del contrato de encargo vigente.
- El seguimiento de aperturas es tratamiento adicional de datos del firmante
  (comportamiento de lectura). Debe estar cubierto por la base de legitimación
  y la finalidad declaradas por la organización Responsable, o desactivarse.
- Verificar la ubicación del tratamiento y las transferencias internacionales de
  cada proveedor antes de incluirlo en el RAT. No están documentadas aquí.

## 4. Decisión pendiente (usuario)

Elegir una de estas salidas antes de programar el envío masivo por el pool:

1. Encontrar el ajuste en Brevo (configuración transaccional o soporte del plan),
   desactivar el seguimiento y repetir la prueba hasta que el cuerpo no tenga
   `/tr/op/`.
2. Aceptar el pixel como riesgo: registrarlo en el RAT y en el contrato de
   encargo, y comunicarlo a la organización Responsable.
3. Enviar solo por Resend (quitar `EMAIL_POOL`, recrear `petition-api` con la
   cola quieta): 150/día, unos 15 días para ~2.200 correos, sin pixel.

Registrar aquí la decisión tomada y su fecha.

## 5. Pendientes de documentación

- [ ] RAT: agregar Brevo y AWS SES como subencargados.
- [ ] Contratos de encargo: cláusula de subencargados y, si aplica, de
      seguimiento de aperturas.
- [ ] Comunicar a las organizaciones Responsables cuyas campañas envíen por el pool.
- [ ] Spec futura (sin crear): cabeceras en `EmailMessage` para
      `List-Unsubscribe` propio.

Ver también: `specs/brevo-pool/design.md`, `specs/ses-transport/design.md`,
`docs/legal/frontera_boletin_listmonk.md` (Resend compartido con el boletín).
