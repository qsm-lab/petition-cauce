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

Tres correos de prueba enviados por la API transaccional v3, vistos en el
mensaje original recibido en Gmail (el primero, de referencia; los otros dos,
tras intentar desactivar el seguimiento en la cuenta de Brevo):

1. **Pixel de seguimiento de aperturas.** El relay de Brevo inyecta en el HTML
   dos etiquetas `<img>` (una en un comentario condicional `[if mso]`, otra con
   `display:none`) que apuntan a `https://r.camp.ecuadornotlc.org/tr/op/...`.
   Nuestro código no lo genera: se agrega después de la API. Este tipo de pixel permite que
   Brevo registre cada apertura (normalmente IP, fecha y cliente de correo del
   firmante); verificar qué conserva Brevo en su política y en el contrato.
   - El dominio del pixel es propio (`camp.ecuadornotlc.org`), pero lo sirve
     Brevo.
   - Un ajuste cambiado en la cuenta de Brevo **no lo quitó** en las dos
     pruebas posteriores (la última, 2026-10-24 17:27 UTC). Puede estar en otra sección del panel,
     no haberse guardado, o no estar disponible en el plan; no está confirmado.
2. **Cabecera `List-Unsubscribe` de Brevo** (`List-Unsubscribe-Post:
   List-Unsubscribe=One-Click`), con un enlace de baja de Brevo. Quien la use
   queda en la lista de bloqueo de Brevo, no en la baja propia de la
   plataforma, por lo que no sustituye el flujo de oposición/ARCO. `EmailMessage`
   no tiene cabeceras, así que hoy no se puede enviar un `List-Unsubscribe` propio.
3. **Autenticación correcta.** SPF, DKIM (`ecuadornotlc.org`, selector `brevo2`)
   y DMARC en `pass` (política `p=NONE`); return-path `camp.ecuadornotlc.org`.

## 3. Decisiones (usuario, 2026-10-24)

- **RAT y contrato actualizados** (`apps/api/app/legal/`): el RAT lista los
  proveedores activos (sección 6) y declara la transferencia a Estados Unidos
  (sección 7); la cláusula séptima del contrato incluye la autorización de
  subencargados. La lista sale de `EMAIL_PROVIDER` y `EMAIL_POOL`
  (`app/legal/subencargados.py`), así que se actualiza sola.
- **País:** se declara Estados Unidos para Resend, Brevo y AWS.
- **Alcance de los datos** (cambio del 2026-10-24, ya en código): a los
  proveedores llegan **solo el email del destinatario y su primer nombre**
  ("nombre simple", `app/services/signer_name.py`: primera palabra del campo
  `signatures.name`, saltando títulos). Se retiraron las etiquetas de
  comunicaciones `<nombre completo>`, `<cédula>`, `<correo>`, `<teléfono>`,
  `<provincia>` y `<organización>`: el servidor las rechaza al guardar,
  previsualizar o enviar (HTTP 422) y, si quedaran en un borrador anterior, se
  renderizan vacías. Solo se acepta `<nombre>`. El RAT y el contrato lo declaran
  así. La separación de nombre y apellido queda para una iteración futura.
- **Pixel de Brevo:** se declara en el RAT y en el contrato como seguimiento de
  aperturas. Sigue sin resolverse en la cuenta de Brevo (ver §2); la decisión
  de desactivarlo o aceptarlo queda abierta.
- Sin spec para este cambio (decisión del usuario, MVP).

## 4. Pendientes para nuevas campañas

- [ ] Verificar las garantías contractuales de cada proveedor para la
      transferencia a Estados Unidos (acuerdos de tratamiento de datos,
      términos de servicio) y la política de retención de eventos de apertura.
- [ ] Contratos ya firmados: cambiar la plantilla no los modifica; evaluar una
      adenda de autorización de subencargados con cada organización Responsable.
- [ ] Decidir sobre el pixel de Brevo (desactivar, o dejarlo declarado).
- [ ] Spec futura (sin crear): cabeceras en `EmailMessage` para
      `List-Unsubscribe` propio.
- [ ] Cuando se active SES en producción, el RAT ya lo listará por configuración;
      revisar que el texto siga siendo correcto.

Ver también: `specs/brevo-pool/design.md`, `specs/ses-transport/design.md`,
`docs/legal/frontera_boletin_listmonk.md` (Resend compartido con el boletín).
