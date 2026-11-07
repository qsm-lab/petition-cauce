import logging

import httpx
from app.config import settings

logger = logging.getLogger(__name__)

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

_TEST_PREFIX = "1x0000000000000000000000000000000"


async def verify_turnstile(token: str) -> bool:
    secret = settings.turnstile_secret_key
    if settings.environment != "production" and (not secret or secret.startswith(_TEST_PREFIX)):
        return True

    # Fail-closed (hardening-campana R1): cualquier fallo de red, timeout o respuesta
    # inválida rechaza el alta. En producción el arranque ya exige una clave real.
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                TURNSTILE_VERIFY_URL,
                data={"secret": secret, "response": token},
                timeout=5.0,
            )
            result = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("turnstile_error type=%s", type(exc).__name__)
        return False
    return bool(result.get("success", False))
