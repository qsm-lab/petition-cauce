# Requirements — cifrado-reposo

## Contexto

Las columnas `email_encrypted` y `cedula_encrypted` de `signatures` hoy almacenan
texto plano (decisión explícita de Fase 1, ver comentario en
`signature_service.py`). Antes de recolectar firmas reales (primera campaña real,
Paso 6 de infra-fork), la PII debe cifrarse en reposo con AES-256-GCM.

**Urgencia:** cifrar antes de tener datos reales evita una migración de datos en
claro con firmantes reales ya almacenados.

## Requisitos

- **R1** El sistema DEBERÁ cifrar `email_encrypted` y `cedula_encrypted` con AES-256-GCM al crear una firma.
- **R2** El sistema DEBERÁ usar una clave de cifrado dedicada (`PII_ENCRYPTION_KEY`, 32 bytes) distinta de `HMAC_SECRET_KEY` y distinta de cualquier clave de forms-qsm.
- **R3** SI `PII_ENCRYPTION_KEY` no está definida o no tiene el tamaño correcto, ENTONCES el API DEBERÁ negarse a arrancar con un error claro (mismo patrón que `HMAC_SECRET_KEY`).
- **R4** El sistema DEBERÁ generar un nonce aleatorio de 12 bytes por cada valor cifrado (nunca reutilizado) y almacenarlo junto al ciphertext.
- **R5** El valor almacenado DEBERÁ llevar prefijo de versión de formato (`enc:v1:`) para permitir rotación de clave/algoritmo futura y distinguirlo de texto legado.
- **R6** CUANDO el sistema necesite el valor en claro (envío de emails de confirmación/notificación, futuros flujos ARCO), DEBERÁ descifrar en memoria mediante un helper único; el valor en claro NUNCA se registra en logs.
- **R7** Las búsquedas y deduplicación DEBERÁN seguir operando exclusivamente sobre `email_hash` / `cedula_hash` / `org_name_hash` (HMAC-SHA256); el cifrado no cambia esos flujos.
- **R8** El sistema DEBERÁ incluir una migración de datos que cifre los valores legados en texto plano existentes en `signatures`; la migración DEBERÁ ser idempotente (detecta el prefijo `enc:v1:` y no re-cifra).
- **R9** SI el descifrado de un valor falla (clave incorrecta, dato corrupto), ENTONCES el sistema DEBERÁ lanzar un error controlado y registrar el evento en logs SIN incluir el valor (solo el id de la firma).
- **R10** Los tests DEBERÁN cubrir: cifrar/descifrar roundtrip, unicidad de nonce, rechazo de arranque sin clave, idempotencia de migración y flujo de firma end-to-end con PII cifrada.

## Fuera de alcance

- Rotación de claves automatizada (el prefijo de versión la habilita a futuro).
- Cifrado de `name` y `org_name` (visibles públicamente cuando `visibility=publica`; el nombre solo se guarda si el firmante eligió visibilidad pública).
- Cifrado a nivel de disco/volumen (responsabilidad del VPS).
