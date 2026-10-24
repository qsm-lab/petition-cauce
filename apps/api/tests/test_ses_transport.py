"""ses-transport: switch Resend↔SES de plataforma y SesTransport (R1–R9).
Sin red: el cliente aioboto3 se reemplaza por un fake."""
import sys
import types

import pytest
from pydantic import ValidationError

from app.config import Settings, settings
from app.services import email_quota, email_transport as et
from app.services.email_transport import (
    EmailMessage, ResendTransport, SesTransport, default_from_email, email_enabled, platform_transport,
)


def _ses(**kw):
    base = dict(region="us-east-1", access_key_id="AK", secret_access_key="SK", max_send_rate=0)
    base.update(kw)
    return SesTransport(**base)


def _msg(**kw):
    return EmailMessage(to=["a@x.com"], subject="s", html="<p>h</p>", from_="Org <f@x.com>", **kw)


class _FakeClient:
    def __init__(self, sink, exc=None):
        self.sink, self.exc = sink, exc

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def send_email(self, **params):
        if self.exc:
            raise self.exc
        self.sink.append(params)
        return {"MessageId": "mid-1"}


def _patch_aioboto3(monkeypatch, sink, exc=None):
    mod = types.ModuleType("aioboto3")
    mod.Session = lambda **kw: types.SimpleNamespace(client=lambda name: _FakeClient(sink, exc))
    monkeypatch.setitem(sys.modules, "aioboto3", mod)


@pytest.mark.asyncio
async def test_ses_send_ok_y_parametros(monkeypatch):
    sink = []
    _patch_aioboto3(monkeypatch, sink)
    res = await _ses(configuration_set="cs").send(_msg(reply_to="r@x.com"))
    assert res.ok and res.provider_id == "mid-1"
    p = sink[0]
    assert p["FromEmailAddress"] == "Org <f@x.com>"
    assert p["Destination"]["ToAddresses"] == ["a@x.com"]
    assert p["ReplyToAddresses"] == ["r@x.com"]
    assert p["ConfigurationSetName"] == "cs"
    assert p["Content"]["Simple"]["Body"]["Html"]["Data"] == "<p>h</p>"


@pytest.mark.asyncio
async def test_ses_error_aws_no_lanza(monkeypatch):
    class Boom(Exception):
        response = {"Error": {"Code": "MessageRejected"}}

    _patch_aioboto3(monkeypatch, [], exc=Boom("x"))
    res = await _ses().send(_msg())
    assert not res.ok and res.error == "MessageRejected"


@pytest.mark.asyncio
async def test_ses_sin_credenciales_modo_dev():
    res = await _ses(access_key_id="").send(_msg())
    assert res.ok and res.provider_id is None


def test_ses_caps():
    c = _ses(daily_quota=200).capabilities()
    assert (c.daily_quota, c.monthly_quota, c.max_batch_size, c.supports_custom_domain) == (200, None, 1, True)


def test_switch_plataforma(monkeypatch):
    monkeypatch.setattr(settings, "email_provider", "resend")
    assert isinstance(platform_transport(), ResendTransport)
    monkeypatch.setattr(settings, "email_provider", "ses")
    assert isinstance(platform_transport(), SesTransport)


def test_email_enabled_y_from_por_proveedor(monkeypatch):
    monkeypatch.setattr(settings, "resend_api_key", "")
    monkeypatch.setattr(settings, "email_provider", "ses")
    monkeypatch.setattr(settings, "aws_access_key_id", "AK")
    monkeypatch.setattr(settings, "aws_secret_access_key", "SK")
    monkeypatch.setattr(settings, "ses_from_email", "ses@x.com")
    assert email_enabled() and default_from_email() == "ses@x.com"
    monkeypatch.setattr(settings, "email_provider", "resend")
    assert not email_enabled() and default_from_email() == settings.resend_from_email


def test_cuota_por_proveedor(monkeypatch):
    monkeypatch.setattr(settings, "email_provider", "resend")
    assert email_quota.platform_quota_key() == "platform"
    monkeypatch.setattr(settings, "email_provider", "ses")
    assert email_quota.platform_quota_key() == "platform-ses"


def _settings(**kw):
    return Settings(_env_file=None, hmac_secret_key="h", pii_encryption_key="a" * 64, **kw)


def test_validacion_arranque():
    assert _settings().email_provider == "resend"
    with pytest.raises(ValidationError):
        _settings(email_provider="sendgrid")
    with pytest.raises(ValidationError):
        _settings(email_provider="ses", aws_access_key_id="AK")  # sin secret
    with pytest.raises(ValidationError):
        _settings(email_provider="ses", aws_access_key_id="AK", aws_secret_access_key="SK")  # sin región/from
    assert _settings(email_provider="ses").email_provider == "ses"  # dev sin claves
