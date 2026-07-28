"""Loop asíncrono in-process para la cola del centro de comunicaciones
(centro-comunicaciones, Fase 3, R13). Deliberadamente **no** usa el
`AsyncIOScheduler` (APScheduler) que ya corre en `app/scheduler.py` para el
job de retención — R13 pide explícitamente un loop propio sin Celery/
APScheduler para esta cola (polling frecuente, no un cron diario).

Lock Redis de corta duración por tick (no uno de sesión larga como
retención): si esta instancia se cae a mitad de un tick, el lock expira solo
y el próximo tick de cualquier instancia puede tomar el trabajo pendiente sin
intervención manual.
"""
import asyncio
import logging
import uuid

from app.config import settings
from app.database import AsyncSessionLocal
from app.redis_client import get_redis
from app.services.comms_queue_service import process_due_scheduled_sends

logger = logging.getLogger(__name__)

_LOCK_KEY = "petition:comms_queue:lock"

_task: asyncio.Task | None = None
_stop_event: asyncio.Event | None = None


async def _run_tick() -> None:
    redis = get_redis()
    token = uuid.uuid4().hex
    acquired = await redis.set(_LOCK_KEY, token, nx=True, ex=settings.comms_queue_poll_seconds)
    if not acquired:
        return
    try:
        async with AsyncSessionLocal() as db:
            result = await process_due_scheduled_sends(db)
            if result["expanded"] or result["batches_processed"]:
                logger.info(
                    "[comms_queue] tick: %s envíos expandidos, %s lotes procesados",
                    result["expanded"], result["batches_processed"],
                )
    except Exception:  # noqa: BLE001
        logger.exception("[comms_queue] error en el tick de la cola")
    finally:
        current = await redis.get(_LOCK_KEY)
        if current == token:
            await redis.delete(_LOCK_KEY)


async def _loop() -> None:
    assert _stop_event is not None
    while not _stop_event.is_set():
        await _run_tick()
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=settings.comms_queue_poll_seconds)
        except asyncio.TimeoutError:
            pass


def start_comms_queue_loop() -> None:
    global _task, _stop_event
    _stop_event = asyncio.Event()
    _task = asyncio.create_task(_loop())


async def stop_comms_queue_loop() -> None:
    global _task, _stop_event
    if _stop_event is not None:
        _stop_event.set()
    if _task is not None:
        await _task
    _task = None
    _stop_event = None
