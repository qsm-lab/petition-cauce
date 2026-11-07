"""hardening-campana R1: Turnstile no puede quedar abierto en producción."""
import httpx
import pytest
from pydantic import ValidationError

from app.config import Settings
from app.services import turnstile_service


def _settings(**over):
    base = dict(
        database_url="postgresql+asyncpg://u:p@h/db",
        database_url_sync="postgresql://u:p@h/db",
        redis_url="redis://h:6379/0",
        jwt_secret_key="x" * 32,
        hmac_secret_key="y" * 32,
        pii_encryption_key="ab" * 32,
    )
    base.update(over)
    return Settings(_env_file=None, **base)


def test_produccion_sin_secreto_no_arranca():
    with pytest.raises(ValidationError, match="TURNSTILE_SECRET_KEY"):
        _settings(environment="production", turnstile_secret_key="")


def test_produccion_con_clave_de_prueba_no_arranca():
    with pytest.raises(ValidationError, match="TURNSTILE_SECRET_KEY"):
        _settings(
            environment="production",
            turnstile_secret_key="1x0000000000000000000000000000000AA",
        )


def test_produccion_con_clave_real_arranca():
    s = _settings(environment="production", turnstile_secret_key="0x4AAAAAAAreal-secret")
    assert s.turnstile_secret_key.startswith("0x4")


def test_desarrollo_sin_secreto_arranca():
    assert _settings(environment="development", turnstile_secret_key="").environment == "development"


@pytest.fixture
def prod(monkeypatch):
    monkeypatch.setattr(turnstile_service.settings, "environment", "production")
    monkeypatch.setattr(turnstile_service.settings, "turnstile_secret_key", "0x4AAAreal")


class _FakeClient:
    def __init__(self, behavior):
        self._behavior = behavior

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, *a, **k):
        return self._behavior()


def _patch_client(monkeypatch, behavior):
    monkeypatch.setattr(turnstile_service.httpx, "AsyncClient", lambda: _FakeClient(behavior))


async def test_timeout_en_produccion_rechaza(prod, monkeypatch):
    def boom():
        raise httpx.ReadTimeout("t")

    _patch_client(monkeypatch, boom)
    assert await turnstile_service.verify_turnstile("tok") is False


async def test_respuesta_no_json_rechaza(prod, monkeypatch):
    class R:
        def json(self):
            raise ValueError("no json")

    _patch_client(monkeypatch, lambda: R())
    assert await turnstile_service.verify_turnstile("tok") is False


async def test_exito_de_cloudflare_acepta(prod, monkeypatch):
    class R:
        def json(self):
            return {"success": True}

    _patch_client(monkeypatch, lambda: R())
    assert await turnstile_service.verify_turnstile("tok") is True


async def test_desarrollo_sin_secreto_sigue_permitiendo(monkeypatch):
    monkeypatch.setattr(turnstile_service.settings, "environment", "development")
    monkeypatch.setattr(turnstile_service.settings, "turnstile_secret_key", "")
    assert await turnstile_service.verify_turnstile("") is True
