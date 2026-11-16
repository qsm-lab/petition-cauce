"""hardening-campana, bloque A: entregabilidad del correo (texto plano + remitente con nombre) y límite de altas por IP.

Sin red: los proveedores se sustituyen (fixture `_no_real_email` o `httpx` simulado).
"""
import sys
import types
import uuid

import httpx
import pytest

from app.config import settings
from app.services import email_service, email_transport as et
from app.services.email_text import html_to_text
from app.services.email_transport import EmailMessage, with_display_name

# Referencias tomadas al importar, antes de que la fixture autouse sustituya `send` por el falso.
_RESEND_SEND = et.ResendTransport.send
_BREVO_SEND = et.BrevoTransport.send


# ─── Texto plano ──────────────────────────────────────────────────────────────

def test_html_to_text_conserva_enlaces_y_saltos_y_omite_head():
    html = (
        "<html><head><title>x</title><style>p{color:red}</style></head><body>"
        "<p>Hola Ana,</p><p>Gracias por apoyar <strong>Yasuní</strong>.<br>Confirma abajo.</p>"
        '<a href="https://cauce.example/confirm/tok">Confirmar mi firma →</a>'
        '<p>Escribe a <a href="mailto:org@x.org">org@x.org</a></p></body></html>'
    )
    text = html_to_text(html)
    assert "color:red" not in text and "x\n" not in text
    assert "Hola Ana," in text and "Gracias por apoyar Yasuní.\nConfirma abajo." in text
    assert "Confirmar mi firma → (https://cauce.example/confirm/tok)" in text
    assert "Escribe a org@x.org" in text and "mailto:" not in text
    assert "\n\n\n" not in text


async def test_confirmacion_lleva_texto_plano_con_el_enlace(monkeypatch, _no_real_email):
    monkeypatch.setattr(email_service, "email_enabled", lambda: True)
    await email_service.send_confirmation_email(
        to_email="persona@correo-real.org", token="tok123", campaign_title="Yasuní", signer_name="Ana",
        org_name="Colectivo Río",
    )
    msg = _no_real_email[0]
    assert msg.text and "/confirm/tok123" in msg.text and "Confirma tu firma" in msg.text
    assert "<" not in msg.text.replace("<-", "")


# ─── Remitente con nombre visible ─────────────────────────────────────────────

async def test_confirmacion_sale_con_el_nombre_de_la_organizacion(monkeypatch, _no_real_email):
    monkeypatch.setattr(email_service, "email_enabled", lambda: True)
    monkeypatch.setattr(settings, "resend_from_email", "info@cauce.example")
    await email_service.send_confirmation_email(
        to_email="persona@correo-real.org", token="t", campaign_title="Yasuní", org_name="Acción Ecológica",
    )
    assert _no_real_email[0].from_ == '"Acción Ecológica" <info@cauce.example>'


@pytest.mark.parametrize("address,name,esperado", [
    ("info@x.org", "", "info@x.org"),
    ("info@x.org", None, "info@x.org"),
    ("Cauce <info@x.org>", "Org", "Cauce <info@x.org>"),
    ("info@x.org", 'Org "rara" <a@b>\r\nBcc: c@d', '"Org rara a@b Bcc: c@d" <info@x.org>'),
])
def test_with_display_name(address, name, esperado):
    assert with_display_name(address, name) == esperado


# ─── Los transportes envían la parte de texto ─────────────────────────────────

def _msg(**kw):
    return EmailMessage(to=["a@x.com"], subject="s", html="<p>h</p>", from_='"Acción" <f@x.com>', text="h", **kw)


class _Resp:
    status_code = 200
    headers: dict = {}

    def json(self):
        return {"id": "m1", "messageId": "m1"}


async def test_resend_y_brevo_incluyen_el_texto(monkeypatch):
    payloads = []

    async def _post(self, url, **kw):
        payloads.append(kw["json"])
        return _Resp()

    monkeypatch.setattr(httpx.AsyncClient, "post", _post)
    await _RESEND_SEND(et.ResendTransport("k"), _msg())
    await _BREVO_SEND(et.BrevoTransport("k"), _msg())
    assert payloads[0]["text"] == "h"
    assert payloads[1]["textContent"] == "h" and payloads[1]["sender"]["name"] == "Acción"


async def test_ses_incluye_el_texto_y_codifica_el_nombre(monkeypatch):
    sink = []

    class _Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def send_email(self, **params):
            sink.append(params)
            return {"MessageId": "m"}

    mod = types.ModuleType("aioboto3")
    mod.Session = lambda **kw: types.SimpleNamespace(client=lambda name: _Client())
    monkeypatch.setitem(sys.modules, "aioboto3", mod)
    ses = et.SesTransport(region="us-east-1", access_key_id="AK", secret_access_key="SK", max_send_rate=0)
    await ses.send(_msg())
    p = sink[0]
    assert p["Content"]["Simple"]["Body"]["Text"]["Data"] == "h"
    assert p["FromEmailAddress"].startswith("=?utf-8?") and p["FromEmailAddress"].endswith("<f@x.com>")


# ─── Límite de altas de firma por IP (CGNAT) ──────────────────────────────────

def test_limite_de_firmas_por_defecto_admite_ip_compartida():
    cantidad, _, periodo = settings.signature_rate_limit.partition("/")
    assert periodo == "minute" and int(cantidad) >= 20


async def test_limite_de_firmas_es_configurable(monkeypatch, client):
    monkeypatch.setattr(settings, "signature_rate_limit", "3/minute")
    # IP aleatoria por corrida: no choca con contadores de pasadas anteriores.
    headers = {"X-Real-IP": f"10.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"}
    payload = {"name": "Ana Pérez", "email": "a@loadtest.invalid", "consent": True, "cf_turnstile_token": "x"}
    url = f"/v1/public-campaign/{uuid.uuid4()}/signatures"
    statuses = [(await client.post(url, json=payload, headers=headers)).status_code for _ in range(4)]
    assert statuses[:3] == [404, 404, 404] and statuses[3] == 429


async def test_endpoint_legado_verify_turnstile_retirado(client):
    r = await client.post("/v1/public/verify-turnstile", json={"token": "x"})
    assert r.status_code in (404, 405)
