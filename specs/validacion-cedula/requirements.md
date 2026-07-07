# Requirements — validacion-cedula

> **Spec retroactiva** (sesión 24): la validación completa ya se implementó en
> `apps/api/app/crypto.py:verify_cedula` y se aplica en el flujo de firma
> (`signature_service.create_signature`). Este documento formaliza los requisitos
> y define lo faltante: **cobertura de tests**.

## Requisitos implementados

- **R1** El sistema DEBERÁ validar la cédula ecuatoriana con el algoritmo módulo-10 (coeficientes 2,1,2,1,2,1,2,1,2; dígitos ≥10 restan 9; verificador = (10 − total%10) % 10).
- **R2** El sistema DEBERÁ rechazar cédulas que no sean exactamente 10 dígitos numéricos (con trim previo).
- **R3** El sistema DEBERÁ validar el código de provincia (dígitos 1-2): rango 01-24 o 30 (ecuatorianos registrados en el exterior).
- **R4** El sistema DEBERÁ rechazar tercer dígito ≥ 6 (reservado a sociedades/RUC; solo personas naturales firman con cédula).
- **R5** CUANDO `location_mode == "nacional"` y la cédula sea requerida u opcional-pero-provista, el sistema DEBERÁ aplicar la validación y responder error `cedula_invalida` / `cedula_requerida` según el caso.
- **R6** CUANDO `location_mode == "internacional"`, el sistema DEBERÁ aceptar cualquier identificación sin validar formato.

## Requisitos pendientes

- **R7** Los tests DEBERÁN cubrir: cédulas válidas reales de distintas provincias, dígito verificador incorrecto, longitud inválida, no numérica, provincia fuera de rango (00, 25-29, 31+), provincia 30 válida, tercer dígito ≥ 6, y el gate por `location_mode` en el flujo de firma.

## Fuera de alcance

- Verificación contra el Registro Civil (no hay API pública; fuera del proyecto).
- Validación de RUC (solo personas naturales firman).
