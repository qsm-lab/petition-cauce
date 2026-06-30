import hashlib
import hmac as hmac_lib

from app.config import settings


def hmac_sha256(value: str, key: str) -> str:
    return hmac_lib.new(
        key.encode(),
        value.encode(),
        hashlib.sha256,
    ).hexdigest()


def compute_hmac(value: str) -> str:
    return hmac_sha256(value, settings.hmac_secret_key)


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
