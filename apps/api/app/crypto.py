import base64
import hashlib
import hmac as hmac_lib
import logging
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

logger = logging.getLogger(__name__)

# Cifrado en reposo de PII (R1-R6 cifrado-reposo)
_ENC_PREFIX = "enc:v1:"
_NONCE_BYTES = 12


class PIIDecryptError(Exception):
    """Fallo al descifrar PII (clave incorrecta, dato corrupto o formato desconocido)."""


def hmac_sha256(value: str, key: str) -> str:
    return hmac_lib.new(
        key.encode(),
        value.encode(),
        hashlib.sha256,
    ).hexdigest()


def compute_hmac(value: str) -> str:
    return hmac_sha256(value, settings.hmac_secret_key)


def _aesgcm() -> AESGCM:
    return AESGCM(bytes.fromhex(settings.pii_encryption_key))


def encrypt_pii(value: str) -> str:
    """Cifra PII con AES-256-GCM. Formato: enc:v1:<base64url(nonce || ct || tag)>."""
    nonce = os.urandom(_NONCE_BYTES)
    ct = _aesgcm().encrypt(nonce, value.encode(), None)
    return _ENC_PREFIX + base64.urlsafe_b64encode(nonce + ct).decode()


def decrypt_pii(token: str, *, ref: str = "") -> str:
    """Descifra un valor enc:v1:. Lanza PIIDecryptError sin exponer el valor.

    `ref` (p. ej. id de la firma) se incluye en el log para diagnóstico.
    """
    if not token.startswith(_ENC_PREFIX):
        logger.error("[pii] formato desconocido al descifrar (ref=%s)", ref)
        raise PIIDecryptError(f"Formato de PII desconocido (ref={ref})")
    try:
        raw = base64.urlsafe_b64decode(token[len(_ENC_PREFIX):])
        nonce, ct = raw[:_NONCE_BYTES], raw[_NONCE_BYTES:]
        return _aesgcm().decrypt(nonce, ct, None).decode()
    except (InvalidTag, ValueError) as exc:
        logger.error("[pii] fallo al descifrar (ref=%s): %s", ref, type(exc).__name__)
        raise PIIDecryptError(f"No se pudo descifrar PII (ref={ref})") from exc


def verify_cedula(cedula: str) -> bool:
    """Valida cédula ecuatoriana (personas naturales) con módulo-10."""
    cedula = cedula.strip()
    if not cedula.isdigit() or len(cedula) != 10:
        return False
    provincia = int(cedula[:2])
    if provincia < 1 or (provincia > 24 and provincia != 30):
        return False
    # 0-5 → persona natural; 6+ → sociedades/RUC especial
    if int(cedula[2]) >= 6:
        return False
    coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    total = sum(
        v - 9 if (v := int(cedula[i]) * coef) >= 10 else v
        for i, coef in enumerate(coeficientes)
    )
    verificador = (10 - (total % 10)) % 10
    return verificador == int(cedula[9])
