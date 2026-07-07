# Design — validacion-cedula

> **Spec retroactiva** (sesión 24). Implementación existente documentada.

## Implementación existente

- `apps/api/app/crypto.py:verify_cedula(cedula: str) -> bool` — validación pura, sin I/O.
- Aplicada en `apps/api/app/services/signature_service.py:create_signature` con gate por `location_mode` y `required_fields` del `form_config` de la campaña.
- Errores lógicos propagados como `ValueError("cedula_invalida")` / `ValueError("cedula_requerida")` → mapeados a respuesta HTTP en el router público.

## Decisiones (reconstruidas)

- Validación **solo matemática/estructural** — sin servicios externos, sin latencia añadida, sin fuga de PII a terceros.
- El firmante internacional no se bloquea por formato (inclusión de diáspora y aliados extranjeros).
- La cédula nunca se persiste en claro definitivo: hash HMAC para dedup + columna cifrable (cifrado-reposo).

## Trabajo restante

- `apps/api/tests/test_cedula.py` — casos R7 (se implementa en el bloque de tests de la sesión 24, literal E).

## LOPDP

- La validación reduce datos basura pero no altera bases de legitimación.
- No se registra la cédula rechazada en logs.
