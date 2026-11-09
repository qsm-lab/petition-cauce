# correo-recuperacion — Requisitos (EARS)

Origen: `hardening-campana` T1.5 (R5). Hoy el correo de confirmación se envía **dentro de la petición de alta**
(`create_signature`), con timeout de 10 s y la conexión de BD retenida. Si el proveedor falla, `_send` devuelve
`False`, `send_confirmation_email` lo **descarta** y la firma queda `pending_confirmation` sin ningún rastro;
solo el firmante puede pedir un reenvío manual, que reenvía el token **aunque haya caducado** (24 h).

## Requisitos

- **R1 — Fuera de la petición.** Cuando se crea una firma, el sistema SHALL guardar la firma con el estado de
  envío `pending` en la misma transacción y responder sin esperar al proveedor de correo.
- **R2 — Envío inmediato como optimización.** Tras responder, el sistema SHALL intentar el envío en segundo plano
  usando el mismo reclamo atómico que el recuperador; si no hay cupo de velocidad, la firma permanece `pending`.
- **R3 — Recuperación.** Un proceso periódico SHALL reintentar las firmas `pending` o `failed` cuyo próximo
  intento ya venció, en lotes acotados y con la velocidad máxima configurada.
- **R4 — Sin duplicados.** Cuando dos workers o un envío inmediato y el recuperador coinciden sobre la misma
  firma, el sistema SHALL enviar a lo sumo un correo por intento (reclamo con `UPDATE ... WHERE estado IN
  ('pending','failed') ... RETURNING`).
- **R5 — Recuperación tras caída.** Un envío en estado `sending` por más de 5 minutos SHALL volver a `failed`
  para reintentarse.
- **R6 — Enlace vigente.** Antes de enviar, si `confirmation_token_expires_at` venció o vence en menos de 1 h, el
  sistema SHALL emitir un token nuevo y extender 24 h su vigencia. El reenvío manual SHALL hacer lo mismo
  (corrige el defecto actual).
- **R7 — Reintentos acotados.** El sistema SHALL reintentar con retardos crecientes (1 min, 5 min, 15 min, 1 h,
  3 h) hasta 6 intentos y después marcar `gave_up`.
- **R8 — Solo lo que corresponde.** El sistema SHALL enviar solo a firmas en `pending_confirmation`; si ya están
  confirmadas SHALL marcar el envío como `not_required`.
- **R9 — Todas las visibilidades.** El comportamiento SHALL ser idéntico para `publica`, `anonima` y `secreta`,
  incluidas campañas en borrador (`is_test`) y organizaciones con configuración de correo propia.
- **R10 — Velocidad y concurrencia.** El sistema SHALL limitar los envíos por segundo y los envíos simultáneos
  por proceso (configurables) para no exceder el límite de peticiones del proveedor.
- **R11 — Datos existentes.** La migración SHALL marcar las firmas ya existentes como `sent` para no generar un
  envío masivo al desplegar.
- **R12 — Observabilidad.** El sistema SHALL registrar `confirm_email_sent|failed|gave_up` sin correo, nombre ni
  IP, y `business_signals.sh` SHALL alertar si hay firmas `gave_up`, o `pending/failed` con más de 10 minutos.
- **R13 — Proveedor.** `send_confirmation_email` SHALL devolver éxito o fallo (hoy devuelve `None`) para que el
  estado refleje la realidad; los errores de cuota o 429 SHALL tratarse como fallo reintentable.
- **R14 — Aislamiento.** Todas las operaciones del recuperador SHALL usar `set_rls_context(platform_admin=True)`
  y las pruebas SHALL cubrir que el contexto no se hereda entre peticiones (T2.4).
- **R15 — Sin PII nueva.** La funcionalidad SHALL NOT añadir datos personales ni subencargados; el correo se
  descifra solo en memoria y nunca se registra.

## Fuera de alcance
Worker en proceso separado (Ola B, T7.1), página intermedia POST contra escáneres (T5.7/T6.7), rediseño del
cuerpo del correo, correo de agradecimiento (ya es de un solo envío).
