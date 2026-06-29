import httpx
from app.config import settings

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

TEST_SECRET = "1x0000000000000000000000000000000AA"


async def verify_turnstile(token: str) -> bool:
    secret = settings.turnstile_secret_key
    if not secret or secret == TEST_SECRET:
        return True

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            TURNSTILE_VERIFY_URL,
            data={"secret": secret, "response": token},
            timeout=5.0,
        )
        result = resp.json()
        return result.get("success", False)
