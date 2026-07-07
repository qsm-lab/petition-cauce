# Tasks — validacion-cedula

> **Spec retroactiva** (sesión 24). T1-T3 implementadas previamente.

## Implementado

- [x] **T1** `verify_cedula` en `crypto.py`: módulo-10, longitud, provincia 01-24/30, tercer dígito < 6 (R1-R4)
- [x] **T2** Gate en `create_signature` por `location_mode` + `required_fields` (R5, R6)
- [x] **T3** Errores `cedula_invalida` / `cedula_requerida` mapeados en el router público (R5)

## Pendiente

- [ ] **T4** `tests/test_cedula.py`: suite completa R7 — válidas por provincia, verificador incorrecto, longitud, no numérica, provincias inválidas, provincia 30, tercer dígito ≥ 6
- [ ] **T5** Test de integración: firma nacional con cédula inválida → error; internacional con id libre → acepta
