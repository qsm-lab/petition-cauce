from slowapi import Limiter
from fastapi import Request

from app.client_ip import get_client_ip
from app.config import settings
from app.crypto import compute_hmac


def _get_real_ip(request: Request) -> str:
    return compute_hmac(get_client_ip(request))


limiter = Limiter(
    key_func=_get_real_ip,
    key_prefix="forms:rl:",
    storage_uri=settings.redis_url,
)
