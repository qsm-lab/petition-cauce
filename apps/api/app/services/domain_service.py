import json
import re

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.domain import Domain
from app.models.campaign import Campaign
from app.redis_client import get_redis

_CACHE_TTL = 300
_CACHE_PREFIX = "petition:domain:"
_INTERNAL_HOSTS = frozenset({
    "localhost", "127.0.0.1", "petition-api", "petition-api-dev",
    "petition-db", "petition-db-dev", "petition-redis", "petition-redis-dev",
})


def _clean_host(host: str) -> str:
    host = host.lower().strip()
    return re.sub(r":\d+$", "", host)


async def resolve_domain(db: AsyncSession, host: str) -> dict | None:
    host = _clean_host(host)
    if host in _INTERNAL_HOSTS:
        return None

    redis = get_redis()
    cache_key = f"{_CACHE_PREFIX}{host}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await db.execute(
        select(Domain, Campaign)
        .join(Campaign, Domain.campaign_id == Campaign.id)
        .where(Domain.host == host, Domain.tls_status == "active")
    )
    row = result.first()
    if not row:
        return None

    domain, campaign = row
    data = {
        "campaign_id": str(campaign.id),
        "campaign_slug": campaign.slug,
        "org_id": str(campaign.org_id),
        "theme_meta": (campaign.meta or {}).get("branding", {}),
    }
    await redis.setex(cache_key, _CACHE_TTL, json.dumps(data))
    return data


async def invalidate_domain_cache(host: str) -> None:
    host = _clean_host(host)
    redis = get_redis()
    await redis.delete(f"{_CACHE_PREFIX}{host}")
