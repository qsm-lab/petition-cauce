# correo-recuperacion — Tareas

- [x] **C1 · Migración 042 + modelo + backfill a `sent`** (R1, R11) · 1 h — prueba: tras migrar, 0 filas `pending`.
- [x] **C2 · `send_confirmation_email` devuelve `bool`; no registrar el correo en dev** (R13, R15) · 0,5 h
- [x] **C3 · `confirmation_email_service`: claim atómico, envío, backoff, tope, `sending` caducado** (R3–R8) · 3 h
- [x] **C4 · Renovación de token en envío y en reenvío manual** (R6) · 1 h
- [x] **C5 · Alta sin envío inline + `BackgroundTasks`** (R1, R2) · 1 h
- [x] **C6 · Limitador de velocidad y semáforo por proceso** (R10) · 1,5 h
- [x] **C7 · Loop en `lifespan` con contexto RLS por transacción** (R3, R14) · 1 h
- [x] **C8 · Pruebas:** carrera de dos sesiones sin duplicado, caída a mitad de envío, expiración y token nuevo,
  tres visibilidades + `is_test` + org con config propia, tope→`gave_up`, `not_required`, migración sin envío
  masivo, aislamiento RLS (R4, R5, R9, R14) · 3 h
- [x] **C9 · Alertas en `business_signals.sh` y logs `confirm_email_*`** (R12) · 1 h
- [ ] **C10 · Prueba de carga:** k6 `race` y `simultaneous` con proveedor simulado con latencia y errores
  (300–800 ms, 5 % de fallos, timeouts de 10 s); verificar que la alta no espera al proveedor (R1, R10) · 2 h

Despliegue: **sí** (cambia runtime y trae migración). Orden: revisar → `alembic upgrade head` (lo hace el
workflow) → comprobar 0 `pending` → vigilar los logs `confirm_email_*`.

## Estado (2026-11-06)
C1–C9 hechas en código; migración 042 aplicada en dev (reversible: upgrade/downgrade/upgrade probados).
Suite: 342 passed (32 nuevos en `tests/test_confirmation_email.py`). **Sin desplegar.** Falta C10 (k6 con proveedor
simulado, requiere un modo de proveedor falso en el entorno aislado `lt-api`).

## Ajustes respecto al diseño original
- El loop corre cada **10 s** (no 30) y no usa lock de Redis: el reclamo atómico por firma basta.
- **Defecto previo corregido:** `create_signature` llamaba a `send_confirmation_email` con argumentos que la
  función no aceptaba (`entered_*`, `arco_review_url`): `TypeError` tragado por el `except`, por lo que **no salía
  ningún correo de confirmación desde el commit `af10af8` (derechos-arco, 2026-07-12)**. `send_confirmation_email`
  ahora implementa el resumen de datos y el enlace «Corregir mis datos» (derechos-arco R19, Frame 0b).
- El token del portal ARCO se emite nuevo en cada envío (la BD solo guarda su HMAC; no se puede reconstruir).
- `send_confirmation_email` descarta dominios reservados (`.test`, `.local`, `.invalid`, `example.*`): no salen
  rebotes y los tests/dev no mandan correo real aunque el contenedor tenga clave.
- El reenvío manual re-encola (estado `pending`, intentos 0) y deja que el servicio renueve el token.
