"""Tests de config-email-org (R7): contador de cuota de email por credencial.

El contador es provider-agnóstico (cuenta cada envío exitoso) y opcionalmente
persiste el último snapshot reportado por el proveedor (headers de Resend).
Se cuenta por credencial (`org_email_config.id` o el default de plataforma),
no por campaña."""
import uuid

import pytest

from app.redis_client import close_redis, get_redis, init_redis
from app.services.email_quota import PLATFORM_QUOTA_KEY, get_usage, record_usage
from app.services.email_service import _send
from app.services.email_transport import EmailMessage, SendResult


class _FakeTransport:
    """Transporte de prueba que no golpea la red — imita capturas de cuota
    reportadas por el proveedor (o su ausencia, como SMTP)."""

    def __init__(self, ok: bool = True, daily_quota_used=None, monthly_quota_used=None):
        self._ok = ok
        self._daily = daily_quota_used
        self._monthly = monthly_quota_used
        self.sent: list[EmailMessage] = []

    async def send(self, msg: EmailMessage) -> SendResult:
        self.sent.append(msg)
        return SendResult(ok=self._ok, daily_quota_used=self._daily, monthly_quota_used=self._monthly)

    def capabilities(self):
        raise NotImplementedError


@pytest.fixture
async def redis_ctx():
    await init_redis()
    yield
    await close_redis()


async def _clear_key(config_key: str):
    redis = get_redis()
    keys = [k async for k in redis.scan_iter(match=f"mail:*{config_key}*")]
    if keys:
        await redis.delete(*keys)


@pytest.mark.asyncio
async def test_record_y_get_usage_incrementa_por_credencial(redis_ctx):
    """R7: el contador propio se incrementa y se lee por credencial, aislado
    entre credenciales distintas."""
    key_a, key_b = f"test-{uuid.uuid4().hex[:8]}", f"test-{uuid.uuid4().hex[:8]}"
    try:
        await record_usage(key_a, sent_count=3)
        await record_usage(key_a, sent_count=2)
        await record_usage(key_b, sent_count=1)

        usage_a = await get_usage(key_a)
        usage_b = await get_usage(key_b)
        assert usage_a["daily_used"] == 5
        assert usage_a["monthly_used"] == 5
        assert usage_b["daily_used"] == 1
    finally:
        await _clear_key(key_a)
        await _clear_key(key_b)


@pytest.mark.asyncio
async def test_snapshot_del_proveedor_se_persiste_y_se_lee(redis_ctx):
    """El último valor reportado por Resend (headers) se guarda y se puede leer;
    sin valores reportados (p. ej. SMTP), el snapshot queda None."""
    key = f"test-{uuid.uuid4().hex[:8]}"
    try:
        usage_antes = await get_usage(key)
        assert usage_antes["provider_snapshot"] is None

        await record_usage(key, daily_quota_used=42, monthly_quota_used=999)
        usage = await get_usage(key)
        assert usage["provider_snapshot"]["daily_quota_used"] == 42
        assert usage["provider_snapshot"]["monthly_quota_used"] == 999
        assert "updated_at" in usage["provider_snapshot"]
    finally:
        await _clear_key(key)


@pytest.mark.asyncio
async def test_send_exitoso_registra_consumo_bajo_quota_key(redis_ctx):
    """Integración: _send() incrementa el contador de la credencial cuya
    transporte se usó (no el default de plataforma) cuando se pasa quota_key."""
    key = f"test-{uuid.uuid4().hex[:8]}"
    transport = _FakeTransport(ok=True, daily_quota_used=7, monthly_quota_used=70)
    try:
        ok = await _send("firmante@test.local", "Asunto", "<p>x</p>",
                          transport=transport, quota_key=key)
        assert ok is True
        usage = await get_usage(key)
        assert usage["daily_used"] == 1
        assert usage["provider_snapshot"]["daily_quota_used"] == 7
    finally:
        await _clear_key(key)


@pytest.mark.asyncio
async def test_send_sin_quota_key_cuenta_contra_plataforma(redis_ctx):
    """Sin quota_key explícito, el consumo se atribuye al default de plataforma
    (comportamiento retrocompatible de los ~15 flujos existentes que aún no
    resuelven una config de org). Usa un transporte falso — no golpea la red
    real de Resend (en dev hay una API key real configurada)."""
    before = await get_usage(PLATFORM_QUOTA_KEY)
    transport = _FakeTransport(ok=True)
    try:
        ok = await _send("firmante@test.local", "Asunto", "<p>x</p>", transport=transport)
        assert ok is True
        after = await get_usage(PLATFORM_QUOTA_KEY)
        assert after["daily_used"] == before["daily_used"] + 1
    finally:
        # No se limpia la clave de plataforma (persistente, compartida entre tests/producción);
        # solo se verifica el delta, no un valor absoluto.
        pass


@pytest.mark.asyncio
async def test_send_fallido_no_registra_consumo(redis_ctx):
    """Un envío que falla no debe contar contra la cuota — no se consumió nada
    en el proveedor."""
    key = f"test-{uuid.uuid4().hex[:8]}"
    transport = _FakeTransport(ok=False)
    try:
        ok = await _send("firmante@test.local", "Asunto", "<p>x</p>",
                          transport=transport, quota_key=key)
        assert ok is False
        usage = await get_usage(key)
        assert usage["daily_used"] == 0
    finally:
        await _clear_key(key)
