"""Loop in-process que recupera los correos de confirmación pendientes (correo-recuperacion).

Sin lock de Redis a propósito: el reclamo atómico por firma (`confirmation_email_service._claim`) ya garantiza
que, con varios workers, cada firma la envíe uno solo por intento. Un fallo del tick no debe matar el loop.
"""
import asyncio
import logging

from app.config import settings
from app.services.confirmation_email_service import process_due

logger = logging.getLogger(__name__)

_task: asyncio.Task | None = None
_stop_event: asyncio.Event | None = None


async def _run_tick() -> None:
    try:
        counts = await process_due()
        if counts.get("due") or counts.get("recovered"):
            logger.info("confirm_email_tick %s", counts)
    except Exception:  # noqa: BLE001
        logger.exception("confirm_email_tick_error")


async def _loop() -> None:
    assert _stop_event is not None
    while not _stop_event.is_set():
        await _run_tick()
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=settings.confirm_email_loop_seconds)
        except asyncio.TimeoutError:
            pass


def start_confirmation_email_loop() -> None:
    global _task, _stop_event
    _stop_event = asyncio.Event()
    _task = asyncio.create_task(_loop())


async def stop_confirmation_email_loop() -> None:
    global _task, _stop_event
    if _stop_event is not None:
        _stop_event.set()
    if _task is not None:
        await _task
    _task = None
    _stop_event = None
