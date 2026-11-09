"""cache-lecturas-publicas: caché corta en Redis para las lecturas públicas de campaña.

Una copia por campaña compartida entre workers; un solo proceso la reconstruye (candado `SET NX`) y el resto sirve la
copia anterior o espera. Si Redis no responde, la lectura va directo a la base (sin caché) y se registra.

Claves (`pubcache:v1:`): `campaign:<id>` (payload público), `recent:<id>:<limit>` e `index` (slug→id e ids de las
campañas visibles, que responde los 404 sin tocar la base: slugs o ids inventados no consumen conexiones).
"""
import asyncio
import json
import logging
import random
import time
import uuid
from typing import Any, Awaitable, Callable

from redis.exceptions import RedisError

from app.config import settings
from app.redis_client import get_redis

logger = logging.getLogger(__name__)

PREFIX = "pubcache:v1:"
_LOCK = "pubcache:lock:"
STALE_TTL = 40       # s que vive la copia en Redis (fresca durante `ttl`, luego obsoleta hasta aquí)
LOCK_TTL = 5         # s del candado del reconstructor
WAIT_SECONDS = 4.0   # espera máxima de quien no tiene copia ni candado (índice y ficha se reconstruyen uno tras otro)
_STEP = (0.1, 0.25)  # sondeo con variación: 300 esperando a la vez no deben saturar Redis ni el bucle de eventos
BYPASS_CONCURRENCY = 8   # lecturas simultáneas a la base por proceso cuando no hay caché (2 workers × 8 < pool de 20)
BYPASS_WAIT = 0.5        # s que espera un turno antes de responder 503 (R5: nunca los 10 s del pool)
_bypass_slots = asyncio.Semaphore(BYPASS_CONCURRENCY)
_REDIS_TIMEOUT = 1.0

_DOWN = (RedisError, OSError, asyncio.TimeoutError, AssertionError)  # AssertionError: Redis sin inicializar
_MISSING = object()
_last_down_log = 0.0
_down_until = 0.0     # interruptor: tras un fallo de Redis no se reintenta durante DOWN_PAUSE s (cada intento tarda: DNS/timeouts)
DOWN_PAUSE = 5.0


class CacheBusy(Exception):
    """Nadie tiene copia y el reconstructor no terminó a tiempo."""


def _log_down(exc: BaseException) -> None:
    global _last_down_log, _down_until
    now = time.monotonic()
    _down_until = now + DOWN_PAUSE
    if now - _last_down_log > 10:  # un aviso cada 10 s, sin datos de la petición
        _last_down_log = now
        logger.warning("public_cache: Redis no disponible (%s); se lee de la base", type(exc).__name__)


async def _call(coro):
    return await asyncio.wait_for(coro, timeout=_REDIS_TIMEOUT)


def _decode(raw: str | None) -> tuple[Any, float]:
    if not raw:
        return _MISSING, 0.0
    try:
        data = json.loads(raw)
        return data["v"], float(data["f"])
    except (ValueError, KeyError, TypeError):
        return _MISSING, 0.0


async def _release(r, lock_key: str, token: str) -> None:
    try:
        if await _call(r.get(lock_key)) == token:
            await _call(r.delete(lock_key))
    except _DOWN:
        pass


async def _bypass(builder: Callable[[], Awaitable[Any]]) -> tuple[Any, str]:
    """Sin caché (apagada o Redis caído): lee de la base con tope de concurrencia para no agotar el pool de las escrituras."""
    try:
        await asyncio.wait_for(_bypass_slots.acquire(), timeout=BYPASS_WAIT)
    except asyncio.TimeoutError:
        raise CacheBusy()
    try:
        return await builder(), "BYPASS"
    finally:
        _bypass_slots.release()


async def get_or_build(key: str, builder: Callable[[], Awaitable[Any]], ttl: int | None = None) -> tuple[Any, str]:
    """Devuelve `(valor, estado)`; estado: HIT | MISS | STALE | BYPASS. El valor debe ser serializable a JSON.

    Una `HTTPException` del constructor (p. ej. 404) se propaga y nunca se cachea ni se reemplaza por una copia obsoleta.
    """
    if not settings.public_cache_enabled:
        return await _bypass(builder)
    ttl = ttl or settings.public_cache_ttl_seconds
    full, lock_key = PREFIX + key, _LOCK + key
    if time.monotonic() < _down_until:
        return await _bypass(builder)

    try:
        r = get_redis()
        value, fresh_until = _decode(await _call(r.get(full)))
    except _DOWN as exc:
        _log_down(exc)
        return await _bypass(builder)
    if value is not _MISSING and fresh_until > time.time():
        return value, "HIT"
    stale = value

    deadline = time.monotonic() + WAIT_SECONDS
    while True:
        token = uuid.uuid4().hex
        try:
            got = await _call(r.set(lock_key, token, nx=True, ex=LOCK_TTL))
        except _DOWN as exc:
            _log_down(exc)
            if stale is not _MISSING:
                return stale, "STALE"
            return await _bypass(builder)
        if got:
            return await _rebuild(r, full, lock_key, token, builder, ttl, stale)
        if stale is not _MISSING:
            return stale, "STALE"  # otro proceso reconstruye: sirvo la anterior
        if time.monotonic() >= deadline:
            raise CacheBusy()
        await asyncio.sleep(random.uniform(*_STEP))
        try:
            value, fresh_until = _decode(await _call(r.get(full)))
        except _DOWN:
            continue
        if value is not _MISSING and fresh_until > time.time():
            return value, "HIT"


async def _rebuild(r, full, lock_key, token, builder, ttl, stale) -> tuple[Any, str]:
    from fastapi import HTTPException

    try:
        value = await builder()
    except HTTPException:
        await _release(r, lock_key, token)
        raise
    except Exception:
        await _release(r, lock_key, token)
        if stale is not _MISSING:
            logger.warning("public_cache: la reconstrucción de %s falló; se sirve la copia anterior", full.split(":")[2])
            return stale, "STALE"
        raise
    try:
        payload = json.dumps({"v": value, "f": time.time() + ttl}, separators=(",", ":"))
        await _call(r.set(full, payload, ex=STALE_TTL))
    except _DOWN as exc:
        _log_down(exc)
    finally:
        await _release(r, lock_key, token)
    return value, "MISS"


async def invalidate(*keys: str) -> None:
    """Borra copias (R7). Nunca falla: si Redis no responde, la copia vence sola en ≤ 40 s."""
    if not keys or not settings.public_cache_enabled:
        return
    try:
        await _call(get_redis().delete(*[PREFIX + k for k in keys]))
    except _DOWN as exc:
        _log_down(exc)


async def invalidate_campaign(campaign_id: str | None) -> None:
    """Campaña editada, publicada, cerrada o archivada: se rehace su copia y el índice (por si cambió el slug)."""
    keys = ["index"]
    if campaign_id:
        keys.append(f"campaign:{campaign_id}")
    await invalidate(*keys)
