from slowapi import Limiter
from fastapi import Request

from app.config import settings
from app.crypto import compute_hmac


def _get_real_ip(request: Request) -> str:
    ip = request.headers.get("X-Real-IP") or request.client.host
    return compute_hmac(ip)


limiter = Limiter(
    key_func=_get_real_ip,
    key_prefix="forms:rl:",
    storage_uri=settings.redis_url,
)
