# Tasks — validacion-cedula

> **Spec retroactiva** (sesión 24). T1-T3 implementadas previamente.

## Implementado

- [x] **T1** `verify_cedula` en `crypto.py`: módulo-10, longitud, provincia 01-24/30, tercer dígito < 6 (R1-R4)
- [x] **T2** Gate en `create_signature` por `location_mode` + `required_fields` (R5, R6)
- [x] **T3** Errores `cedula_invalida` / `cedula_requerida` mapeados en el router público (R5)

## Pendiente

- [x] **T4** `tests/test_cedula.py`: suite completa R7 — válidas por provincia, verificador incorrecto, longitud, no numérica, provincias inválidas, provincia 30, tercer dígito ≥ 6. Ya estaba commiteado (`c99c445`) — esta spec no lo reflejaba.
- [x] **T5** `tests/test_validacion_cedula_integracion.py` (sesión 38): `create_signature` real contra DB — nacional sin cédula → `cedula_requerida`; nacional con verificador incorrecto → `cedula_invalida`; nacional válida → firma creada; internacional con identificación libre no numérica → acepta sin validar. Suite completa: 171 passed (167 previos + 4 nuevos).
