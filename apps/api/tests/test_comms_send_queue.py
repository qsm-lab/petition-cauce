"""El envío REAL del centro de comunicaciones entra a la cola (lotes diarios por
cupo); solo las pruebas salen en el acto."""
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

from app.routers import campaigns as router
from app.schemas.comms import CommsSendRequest

_send = router.comms_send
_send = getattr(_send, "__wrapped__", _send)  # sin el rate limit de slowapi


def _campaign():
    return SimpleNamespace(id=uuid.uuid4(), org_id=uuid.uuid4(), archived_at=None, social_links=None)


def _patch_common(monkeypatch):
    camp = _campaign()

    async def fake_get(db, cid, scope):
        return camp, SimpleNamespace(name="Org", logo_url="")

    monkeypatch.setattr(router.CampaignService, "get_campaign_with_lifecycle", fake_get)
    monkeypatch.setattr(router, "_org_scope", lambda u: None)
    return camp


async def test_envio_real_va_a_la_cola_para_ahora(monkeypatch):
    camp = _patch_common(monkeypatch)
    llamadas = []

    async def fake_schedule(db, **kw):
        llamadas.append(kw)
        return SimpleNamespace(id=uuid.uuid4(), recipient_count=1236)

    async def no_debe_enviar(*a, **k):
        raise AssertionError("el envío real no debe enviar en el request")

    monkeypatch.setattr(router, "schedule_send", fake_schedule)
    monkeypatch.setattr(router, "_send", no_debe_enviar)

    antes = datetime.now(timezone.utc)
    data = CommsSendRequest(type="general", subject="Asunto", body_html="<p>Hola <nombre></p>")
    res = await _send(None, str(camp.id), data, SimpleNamespace(id=uuid.uuid4()), None)

    assert res["queued"] is True and res["mode"] == "real" and res["sent_count"] == 0
    assert res["recipient_count"] == 1236
    assert len(llamadas) == 1
    assert antes <= llamadas[0]["scheduled_at"] <= datetime.now(timezone.utc)
    assert llamadas[0]["draft_id"] is None


async def test_envio_real_promueve_el_borrador(monkeypatch):
    camp = _patch_common(monkeypatch)
    capturado = {}

    async def fake_schedule(db, **kw):
        capturado.update(kw)
        return SimpleNamespace(id=uuid.uuid4(), recipient_count=1)

    monkeypatch.setattr(router, "schedule_send", fake_schedule)
    draft = uuid.uuid4()
    data = CommsSendRequest(type="general", subject="A", body_html="<p>x</p>", draft_id=str(draft))
    await _send(None, str(camp.id), data, SimpleNamespace(id=uuid.uuid4()), None)
    assert capturado["draft_id"] == draft


async def test_prueba_sale_en_el_acto_sin_cola(monkeypatch):
    camp = _patch_common(monkeypatch)
    enviados = []

    async def no_debe_encolar(*a, **k):
        raise AssertionError("una prueba no entra a la cola")

    async def fake_ctx(db, campaign, org):
        return object(), {"from_": "a@b.ec", "reply_to": None}, "platform"

    async def fake_send(to, subject, html, **kw):
        enviados.append(to)
        return True

    async def fake_log(*a, **k):
        return None

    monkeypatch.setattr(router, "schedule_send", no_debe_encolar)
    monkeypatch.setattr(router, "_resolve_campaign_email_context", fake_ctx)
    monkeypatch.setattr(router, "_send", fake_send)
    monkeypatch.setattr(router, "log_send", fake_log)

    data = CommsSendRequest(type="general", subject="A", body_html="<p>Hola <nombre></p>", test_emails=["t@x.ec"])
    res = await _send(None, str(camp.id), data, SimpleNamespace(id=uuid.uuid4()), None)
    assert enviados == ["t@x.ec"]
    assert res == {"sent_count": 1, "recipient_count": 1, "mode": "test"}
