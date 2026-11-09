# verificacion-confirmacion-privacidad — Diseño

## D1 — Cómo evitar la confirmación por escáner (decisión del usuario)
| Opción | Qué cambia | Pros | Contras |
|---|---|---|---|
| **A (recomendada)** | El enlace abre una página `/confirmar/<token>` con un botón «Confirmar mi firma»; el botón hace `POST` y confirma | Los escáneres hacen `GET` y no confirman; es el patrón estándar | Un clic más; hay que diseñar la pantalla (Claude Design) |
| B | Mantener el `GET` y aceptar el riesgo; medir cuántas confirmaciones ocurren < 2 s tras el envío | Cero cambios | Consentimiento verificado por máquina; métricas infladas |
| C | Detectar escáneres por `User-Agent`/latencia y no confirmar | Sin clic extra | Frágil: cada escáner es distinto |

**Impacto de A:** frontend con pantalla nueva (requiere diseño aprobado en Claude Design), endpoint `POST /confirm/{token}`,
el `GET` deja de confirmar y solo redirige a la página. Los enlaces ya enviados (`/confirm/<token>`) deben seguir funcionando: el `GET`
viejo redirige a `/confirmar/<token>` para no romper correos en tránsito.

## Archivos afectados (con la opción A)
- `apps/api/app/routers/public_campaign.py`: `GET /confirm/{token}` → redirección; `POST /confirm/{token}` → confirma.
- `apps/web/src/app/(campaign)/confirmar/[token]/page.tsx` (nuevo) + `specs/<feature>/design-export.html`.
- `apps/api/tests/`: el `GET` no cambia el estado; el `POST` confirma; idempotencia; token vencido.
- Aviso de privacidad (`apps/web/src/app/aviso-de-privacidad/page.tsx`) y RAT: proveedores (R4).

## Verificación (sin código nuevo)
1. **Buzones reales (R3):** una firma de prueba por proveedor de correo; anotar en una tabla: llegó, carpeta, enlace reescrito, hora de
   apertura del escáner (visible en el log `app.access`, solo método y ruta).
2. **Seguimiento (R5):** abrir el HTML recibido y buscar `<img` con dimensiones 1×1 y dominios de seguimiento; revisar en Brevo/Resend
   que «open tracking» y «click tracking» estén desactivados para el correo transaccional.
3. **ARCO (R6):** firmar, entrar a `mis-datos`, pedir acceso y rectificación, medir el tiempo y quién recibe el correo de la org.

## Seguridad y LOPDP
- No se agregan campos con datos personales. El `POST` no revela si el token existe (misma respuesta genérica).
- `privacy_config` no cambia; el aviso se corrige para coincidir con el sistema (R4).
- Rate limit del `POST /confirm` igual que el resto de endpoints públicos.
