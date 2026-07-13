# Design — remediacion-nombres-incompletos
> Sesión 31 · 2026-07-13 · Documentado retroactivamente (implementado y desplegado
> con aprobación conversacional del usuario en la misma sesión, no spec previa).

## Contexto

`signature_service.create_signature` guardaba `name=NULL` cuando
`visibility != 'publica'` (decisión de minimización, sesión 1). El formulario
público le promete al firmante anónimo: *"tu firma se suma al conteo y al
documento de entrega, pero tu nombre no se muestra públicamente"* — promesa
imposible de cumplir sin conservar el nombre. Corregido en la misma sesión
(ver `signature_service.py`), pero el histórico ya afectado necesitaba
remediación: campaña real activa con 247 firmas sin nombre completo.

## Decisiones de diseño

- **Criterio de "incompleto"**: `name IS NULL OR name` sin espacio interno
  (una sola palabra). No valida más allá de eso (no exige apellido real).
- **Excluye `secreta`**: su firma nunca integra el documento de entrega
  (promesa distinta y más fuerte que `anonima`), así que la justificación
  del email ("necesario para... la entrega") no le aplica.
- **Consolida completar + confirmar**: si la firma seguía
  `pending_confirmation`, se promueve a `confirmed` en el mismo paso que
  completa el nombre — evita un segundo email/token para lo mismo.
- **Token dedicado** (`completion_token`, 7 días — más largo que el de
  confirmación normal de 24h, porque es un pedido inesperado semanas
  después de firmar) en vez de reutilizar `confirmation_token`.
- **Popup en la landing pública** (`?completar=<token>`), no una página
  nueva — reutiliza el patrón ya existente de `ConfirmedSharePopup`
  (`?confirmada=1`), da contexto de campaña real y no requiere ronda nueva
  de Claude Design.
- **Disparo por script CLI** (no botón admin): es remediación de un evento
  histórico puntual, no una acción recurrente. `--dry-run` obligatorio antes
  de cualquier corrida real; `--force` para reenviar a quien ya tiene un
  token vigente (idempotente por defecto).

## Archivos

### Backend
| Archivo | Rol |
|---------|-----|
| `apps/api/migrations/versions/032_signature_completion_token.py` | `completion_token` + `completion_token_expires_at` en `signatures` |
| `apps/api/app/models/signature.py` | columnas nuevas |
| `apps/api/app/schemas/signature.py` | `CompleteNameRequest` |
| `apps/api/app/services/signature_service.py` | `get_completion_context`, `complete_signature_name`, `COMPLETION_TOKEN_TTL_DAYS` |
| `apps/api/app/routers/public_campaign.py` | `GET/POST /v1/public-campaign/complete/{token}` |
| `apps/api/app/services/email_service.py` | `send_name_completion_email` |
| `apps/api/app/scripts/send_name_completion_emails.py` | script CLI de disparo |

### Frontend
| Archivo | Rol |
|---------|-----|
| `apps/web/src/app/(campaign)/components/CompleteNamePopup.tsx` | popup con el form de nombre |
| `apps/web/src/app/c/[slug]/page.tsx` | detecta `?completar=` y renderiza el popup |

## Seguridad / RLS

- `get_completion_context`/`complete_signature_name` usan el mismo bypass
  transaccional `app.is_platform_admin` que `confirm_signature` (mismo
  problema de raíz: la fila resultante no tiene ninguna política RLS que le
  dé visibilidad a una sesión anónima).
- Validación server-side: nombre debe tener espacio interno y ≥3 caracteres
  (422 si no). Token de un solo uso, se anula tras completar.
- Rate limiting: `GET` 20/min, `POST` 10/min (`slowapi`, mismo patrón que el
  resto de endpoints públicos).

## LOPDP

- **Base de legitimación**: la misma del consentimiento original de firma
  (Art. 8, LOPDP) — se corrige un dato ya consentido, no se recolecta con
  fin nuevo.
- **Minimización preservada**: el nombre sigue sin exponerse públicamente
  para `anonima`/`secreta` tras completarlo — solo se corrige el dato
  interno (feed público, export, dashboard siguen respetando la visibilidad
  elegida).
- **Trazabilidad**: `completion_token`/`completion_token_expires_at` se
  anulan tras usarse; no queda tabla de auditoría dedicada (a diferencia de
  `pii_export_audit`) — es una corrección de dato propio del titular, no un
  acceso masivo a PII por un tercero.

## Resultado de la primera corrida (producción)

Campaña `soberania-tlc-ecu-usa`: 247 candidatos (239 `anonima` con
`name=NULL`, 8 `publica` con nombre de una palabra, 0 `secreta` — excluidas
correctamente). Verificado sin contaminación de `is_test` antes del envío
real. **247/247 enviados.**

## Pendiente

- Ampliar el recordatorio de confirmación (`remind-pending`, parte de
  `dashboard-firmas`) para incluir `anonima`/`secreta` `pending_confirmation`
  — hoy solo cubre `publica`. Requiere copy de email propio, sin mención al
  nombre (no aplica para esos casos).
- Sin mecanismo de reintento automático si el envío a Resend falla para un
  registro puntual dentro de una corrida — el `completion_token` ya quedó
  generado y commiteado antes del intento de envío (best-effort, mismo
  patrón que el resto de emails del proyecto). `--force` permite re-disparar
  manualmente si se detecta un caso así.
