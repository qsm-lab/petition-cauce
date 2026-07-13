import logging
import uuid

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import AsyncSessionLocal
from app.redis_client import get_redis
from app.services.retention_service import run_retention

logger = logging.getLogger(__name__)

RETENTION_LOCK_KEY = "petition:retention:lock"
RETENTION_LOCK_TTL_SECONDS = 3600

_scheduler: AsyncIOScheduler | None = None


async def acquire_retention_lock() -> str | None:
    """Intenta tomar el lock de retención (SET NX). Devuelve el token si lo obtuvo, None si ya está tomado (R8)."""
    redis = get_redis()
    token = uuid.uuid4().hex
    acquired = await redis.set(RETENTION_LOCK_KEY, token, nx=True, ex=RETENTION_LOCK_TTL_SECONDS)
    return token if acquired else None


async def release_retention_lock(token: str) -> None:
    redis = get_redis()
    current = await redis.get(RETENTION_LOCK_KEY)
    if current == token:
        await redis.delete(RETENTION_LOCK_KEY)


async def run_scheduled_retention() -> None:
    token = await acquire_retention_lock()
    if token is None:
        logger.info("[retention] corrida saltada: lock ya tomado por otra instancia")
        return
    try:
        async with AsyncSessionLocal() as db:
            run = await run_retention(db, trigger="scheduled")
            logger.info(
                "[retention] corrida programada: %s campañas evaluadas, %s firmas anonimizadas",
                run.campaigns_evaluated, run.signatures_anonymized,
            )
    finally:
        await release_retention_lock(token)


def start_scheduler() -> None:
    global _scheduler
    _scheduler = AsyncIOScheduler(timezone="America/Guayaquil")
    _scheduler.add_job(
        run_scheduled_retention,
        CronTrigger(hour=3, minute=0),
        id="retention_daily",
        replace_existing=True,
    )
    _scheduler.start()


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
