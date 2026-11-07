# correo-recuperacion — Diseño

## Archivos afectados
| Archivo | Cambio |
|---|---|
| `migrations/versions/042_confirmation_email_state.py` | Columnas nuevas en `signatures` + índice parcial + backfill |
| `app/models/signature.py` | 5 columnas nuevas |
| `app/services/confirmation_email_service.py` (nuevo) | Reclamo atómico, envío, backoff, renovación de token, recuperación de `sending` |
| `app/confirmation_email_loop.py` (nuevo) | Loop periódico (mismo patrón que `comms_scheduler_loop`) |
| `app/services/email_service.py` | `send_confirmation_email` devuelve `bool` |
| `app/services/signature_service.py` | `create_signature`: guarda `pending` y ya no envía inline |
| `app/routers/public_campaign.py` | Alta: `BackgroundTasks` para el intento inmediato; reenvío manual renueva el token |
| `app/config.py` | `confirm_email_max_per_second`, `confirm_email_max_concurrent`, `confirm_email_loop_seconds`, `confirm_email_max_attempts` |
| `app/main.py` | Arranque y parada del loop en `lifespan` |
| `infra/monitoring/business_signals.sh` | Alertas `gave_up` y antigüedad de `pending/failed` |

## Modelo de datos (migración 042)
`signatures`: `confirmation_email_status` varchar(12) (`pending|sending|sent|failed|gave_up|not_required`),
`confirmation_email_attempts` smallint default 0, `confirmation_email_next_at` timestamptz,
`confirmation_email_claimed_at` timestamptz, `confirmation_email_sent_at` timestamptz.
Índice parcial `WHERE confirmation_email_status IN ('pending','failed','sending')`.
**Backfill:** todas las filas existentes → `sent` (si ya están confirmadas, `not_required`). Sin envío masivo.
La migración no cambia políticas RLS (las columnas viven en una tabla que ya tiene RLS).

## Flujo
1. `create_signature`: inserta con estado `pending`, `next_at=now()`, commit, responde.
2. `BackgroundTasks`: abre sesión propia, `claim(sig_id)`; si lo obtiene y el limitador de velocidad lo permite,
   envía y marca `sent`/`failed`.
3. Loop cada `confirm_email_loop_seconds` (30 s): (a) `sending` con `claimed_at < now()-5 min` → `failed`;
   (b) selecciona hasta N firmas `pending/failed` con `next_at <= now()` ordenadas por antigüedad y las reclama
   una a una; respeta la misma cota de velocidad.
4. Cada envío: renueva el token si vence en <1 h (R6), descifra el correo (`decrypt_pii`) en memoria, arma el
   mismo mensaje que hoy (visibilidad, aviso de privacidad, contacto de la org) y envía.
5. Resultado: `sent` → `sent_at`; fallo → `attempts+1`, `next_at = now()+backoff[attempts]`; al llegar al tope →
   `gave_up`.

## Reclamo atómico (lección de la sesión 42)
```sql
UPDATE signatures
   SET confirmation_email_status='sending', confirmation_email_claimed_at=now(),
       confirmation_email_attempts = confirmation_email_attempts + 1
 WHERE id = :id AND confirmation_email_status IN ('pending','failed')
   AND confirmation_email_next_at <= now()
RETURNING id;
```
Estilo Core, no asignación ORM; el que obtiene 0 filas se retira. Cierre con `UPDATE ... WHERE status='sending'`
para que un cierre tardío no pise a una recuperación. Garantía: **al menos un envío** (si el proceso cae entre el
acuse del proveedor y el `UPDATE`, el recuperador reenvía tras 5 min); se acepta como duplicado raro. Si el
proveedor soporta clave de idempotencia (Resend `Idempotency-Key`), usar `sig_id:intento`. Verificar en T1.

## Velocidad y cuota
Limitador por proceso (token bucket) `confirm_email_max_per_second` (por defecto 2, **confirmar el límite real de
la cuenta de Resend/Brevo**) y semáforo `confirm_email_max_concurrent` (5). Con 2 workers el total es el doble:
dimensionar con esto en mente. Errores 429/cuota → `failed` con el backoff normal; el protocolo diario de la
campaña (subir plan o combinar Brevo y Resend) se apoya en la alerta de R12.

## Seguridad y privacidad (`privacy_config`)
- Sin datos nuevos, sin finalidad nueva, sin subencargados nuevos: es el mismo correo transaccional ya declarado.
- El correo se descifra solo en memoria del recuperador; los logs llevan `sig_id` (UUID), estado e intento.
- `send_confirmation_email` en modo desarrollo registra el correo en claro (`to=%s`): cambiar a no registrarlo.
- RLS: el loop y la tarea inmediata usan `platform_admin` por transacción (`set_rls_context`); el reenvío manual
  conserva su contexto público y no escribe cuentas de otras firmas.
- Enumeración: el reenvío manual sigue devolviendo siempre 204.

## Riesgos
| Riesgo | Mitigación |
|---|---|
| Duplicados por carrera | Reclamo atómico + cierre condicional + pruebas con dos sesiones |
| Tormenta de reintentos tras una caída del proveedor | Backoff creciente, tope de intentos, límite de velocidad |
| Migración con envío masivo accidental | Backfill a `sent`; prueba que cuenta cero `pending` tras migrar |
| Loop caído sin que nadie lo vea | Alerta por antigüedad de `pending/failed` (R12) |
| Correo tardío para quien firma | Intento inmediato en segundo plano; el loop es la red de seguridad |
