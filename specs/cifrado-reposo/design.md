# Design — cifrado-reposo

## Decisiones

### Algoritmo y librería
- **AES-256-GCM** vía `cryptography.hazmat.primitives.ciphers.aead.AESGCM` (la librería `cryptography` ya es dependencia transitiva del stack; verificar y fijar en `requirements.txt`).
- Nonce de 12 bytes con `os.urandom(12)` por valor (R4). GCM autentica: cualquier alteración del ciphertext falla al descifrar.

### Formato de almacenamiento (R5)
```
enc:v1:<base64url(nonce || ciphertext || tag)>
```
- Prefijo `enc:v1:` distingue de texto legado y habilita `v2` futura (rotación).
- Columnas actuales `Text` ya soportan el tamaño; sin cambio de schema de columnas.

### Clave (R2, R3)
- Nueva setting `pii_encryption_key: str` en `config.py`, obligatoria.
- Valor: 64 hex chars (32 bytes), generado con `openssl rand -hex 32`.
- Validación al arrancar en el mismo punto donde se valida `hmac_secret_key`; error claro si falta o tiene tamaño inválido.
- Agregar a `.env.example` con comentario; el usuario la agrega a `.env`/`.env.dev` y al VPS **antes** del deploy de esta feature.

### API interna (R1, R6, R9)
En `app/crypto.py`:
```python
def encrypt_pii(value: str) -> str          # → "enc:v1:..."
def decrypt_pii(token: str, *, ref: str = "") -> str
```
- `decrypt_pii` lanza `PIIDecryptError` en fallo; loguea `ref` (id de firma), nunca el valor.
- `decrypt_pii` sobre un valor sin prefijo `enc:` lanza error (no hay fallback silencioso a plano: tras la migración R8 no debe quedar texto legado).

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `apps/api/app/config.py` | `pii_encryption_key` obligatoria + validación de arranque |
| `apps/api/app/crypto.py` | `encrypt_pii`, `decrypt_pii`, `PIIDecryptError` |
| `apps/api/app/services/signature_service.py` | `create_signature`: cifrar email y cédula al persistir |
| `apps/api/app/services/campaign_service.py` | `get_signer_emails_for_notify`: descifrar emails antes de enviar |
| `apps/api/migrations/versions/015_encrypt_pii_at_rest.py` | Migración de datos: cifra filas legadas (idempotente) |
| `apps/api/requirements.txt` | Fijar `cryptography` explícita |
| `apps/api/tests/test_crypto_pii.py` | Tests R10 |
| `.env.example` | `PII_ENCRYPTION_KEY=` documentada |

### Puntos de lectura de PII (inventario sesión 24)
1. `campaign_service.get_signer_emails_for_notify` — único punto que lee `email_encrypted` hoy → descifrar ahí.
2. `signature_service.create_signature` — usa `email_normalized` en memoria para el email de confirmación (antes de cifrar); sin cambio.
3. Admin/exports/dedup — operan sobre hashes o campos no-PII; sin cambio (R7).

### Migración de datos (R8)
- Migración Alembic `015`: `SELECT id, email_encrypted, cedula_encrypted FROM signatures` por lotes; si el valor no empieza con `enc:`, cifrar y `UPDATE`.
- Corre dentro del proceso API (tiene acceso a `PII_ENCRYPTION_KEY` vía settings).
- Idempotente: re-ejecutar no re-cifra (chequeo de prefijo).
- **Orden de deploy:** agregar clave al `.env` del VPS → deploy → `alembic upgrade head`.

## Seguridad

- Clave nunca en logs ni en respuestas de error.
- HMAC y cifrado usan claves independientes: comprometer una no compromete la otra.
- GCM provee integridad: un dump de DB alterado no puede inyectar PII falsa sin detección.

## LOPDP

- Medida técnica de seguridad exigible al Encargado (LOPDP Ecuador, medidas de seguridad de datos personales): reduce el impacto de una brecha de la base de datos — la PII es ilegible sin la clave del VPS.
- No cambia bases de legitimación ni flujos de consentimiento.
- El RAT (rat-autogenerado, fase 3) deberá declarar "cifrado en reposo AES-256-GCM" como medida de seguridad.
- En notificación de brechas: si solo se exfiltra la DB (sin la clave), la PII cifrada puede argumentarse como no accedida — documentar en el runbook de brechas de lopdp-base.
