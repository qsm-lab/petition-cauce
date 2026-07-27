"""Contador de cuota de email por credencial de proveedor (config-email-org, R7).

Se cuenta por **credencial** (`org_email_config.id`, o `PLATFORM_QUOTA_KEY` para
el default de plataforma) — no por campaña: varias campañas de una misma org
que comparten config comparten la misma cuota. Complementa `TransportCaps`
(el techo declarado por el adaptador) con el consumo real, provider-agnóstico
(funciona igual para Resend, SMTP u otro adaptador futuro).

Para Resend específicamente, además se persiste el último valor *reportado
por el proveedor* vía headers (`x-resend-daily/monthly-quota`) — más autoritativo
que nuestro propio conteo cuando está disponible (design.md §Lectura de cuota).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from app.redis_client import get_redis

PLATFORM_QUOTA_KEY = "platform"

# TTL con margen sobre el período que miden, para tolerar desfases de huso
# horario entre el reloj del servidor y el del proveedor.
_DAILY_TTL_SECONDS = 60 * 60 * 26
_MONTHLY_TTL_SECONDS = 60 * 60 * 24 * 32


def _daily_key(config_key: str, day: str) -> str:
    return f"mail:quota:{config_key}:{day}"


def _monthly_key(config_key: str, month: str) -> str:
    return f"mail:quota:{config_key}:{month}"


def _snapshot_key(config_key: str) -> str:
    return f"mail:resend-quota:{config_key}"


async def record_usage(
    config_key: str,
    *,
    sent_count: int = 1,
    daily_quota_used: int | None = None,
    monthly_quota_used: int | None = None,
) -> None:
    """Registra un envío exitoso: incrementa el contador propio y, si el
    proveedor reportó consumo (headers de Resend), actualiza el snapshot."""
    now = datetime.now(timezone.utc)
    redis = get_redis()

    daily_k = _daily_key(config_key, now.strftime("%Y-%m-%d"))
    monthly_k = _monthly_key(config_key, now.strftime("%Y-%m"))
    await redis.incrby(daily_k, sent_count)
    await redis.expire(daily_k, _DAILY_TTL_SECONDS)
    await redis.incrby(monthly_k, sent_count)
    await redis.expire(monthly_k, _MONTHLY_TTL_SECONDS)

    if daily_quota_used is None and monthly_quota_used is None:
        return
    payload = {
        "daily_quota_used": daily_quota_used,
        "monthly_quota_used": monthly_quota_used,
        "updated_at": now.isoformat(),
    }
    await redis.set(_snapshot_key(config_key), json.dumps(payload), ex=_MONTHLY_TTL_SECONDS)


async def get_usage(config_key: str) -> dict:
    """Consumo actual: contador propio (today/month) + último snapshot del
    proveedor si existe (None si el adaptador no lo reporta, p. ej. SMTP)."""
    now = datetime.now(timezone.utc)
    redis = get_redis()

    daily = await redis.get(_daily_key(config_key, now.strftime("%Y-%m-%d")))
    monthly = await redis.get(_monthly_key(config_key, now.strftime("%Y-%m")))
    raw_snapshot = await redis.get(_snapshot_key(config_key))

    return {
        "daily_used": int(daily) if daily else 0,
        "monthly_used": int(monthly) if monthly else 0,
        "provider_snapshot": json.loads(raw_snapshot) if raw_snapshot else None,
    }
