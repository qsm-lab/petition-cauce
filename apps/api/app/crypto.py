import hashlib
import hmac as hmac_lib

from app.config import settings


def compute_hmac(value: str) -> str:
    return hmac_lib.new(
        settings.hmac_secret_key.encode(),
        value.encode(),
        hashlib.sha256,
    ).hexdigest()
