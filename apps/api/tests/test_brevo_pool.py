"""brevo-pool: BrevoTransport, pool de plataforma y reparto de la cola (R1–R11).
Sin red ni DB: httpx, get_usage y _send_chunk se reemplazan por fakes."""
import types
import uuid

import pytest
from pydantic import ValidationError

from app.config import Settings, settings
from app.models.scheduled_send import ScheduledSend
from app.models.send_batch import SendBatch
from app.services import comms_queue_service as q
from app.services import email_transport as et
from app.services.email_quota import platform_quota_key
from app.services.email_transport import BrevoTransport, EmailMessage, PoolMember, platform_pool

_REAL_BREVO_SEND = BrevoTransport.send  # la fixture autouse lo reemplaza en cada test


def _msg(**kw):
    return EmailMessage(to=["a@x.com"], subject="s", html="<p>h</p>", from_="Org <f@x.com>", **kw)


class _Resp:
    def __init__(self, status, body=None):
        self.status_code, self._body = status, body or {}

    def json(self):
        return self._body


def _fake_httpx(monkeypatch, resp, sink):
    class _Client:
        def __init__(self, **kw): ...
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False

        async def post(self, url, headers=None, json=None):
            sink.append((url, headers, json))
            if isinstance(resp, Exception):
                raise resp
            return resp

    monkeypatch.setattr(et.httpx, "AsyncClient", _Client)
    monkeypatch.setattr(BrevoTransport, "send", _REAL_BREVO_SEND)


# ── BrevoTransport (R1, R2) ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_brevo_send_ok_y_payload(monkeypatch):
    sink = []
    _fake_httpx(monkeypatch, _Resp(201, {"messageId": "<m1@brevo>"}), sink)
    res = await BrevoTransport("KEY").send(_msg(reply_to="Resp <r@x.com>"))
    assert res.ok and res.provider_id == "<m1@brevo>"
    url, headers, body = sink[0]
    assert url == "https://api.brevo.com/v3/smtp/email" and headers["api-key"] == "KEY"
    assert body["sender"] == {"email": "f@x.com", "name": "Org"}
    assert body["to"] == [{"email": "a@x.com"}] and body["replyTo"] == {"email": "r@x.com"}
    assert body["htmlContent"] == "<p>h</p>" and body["subject"] == "s"


@pytest.mark.asyncio
@pytest.mark.parametrize("status,error", [(429, "rate_limited"), (500, "http_500"), (401, "http_401")])
async def test_brevo_errores_http(monkeypatch, status, error):
    _fake_httpx(monkeypatch, _Resp(status), [])
    res = await BrevoTransport("KEY").send(_msg())
    assert not res.ok and res.error == error


@pytest.mark.asyncio
async def test_brevo_excepcion_de_red_no_lanza(monkeypatch):
    _fake_httpx(monkeypatch, RuntimeError("boom"), [])
    res = await BrevoTransport("KEY").send(_msg())
    assert not res.ok and res.error == "RuntimeError"


@pytest.mark.asyncio
async def test_brevo_sin_clave_modo_dev(monkeypatch):
    monkeypatch.setattr(BrevoTransport, "send", _REAL_BREVO_SEND)
    assert (await BrevoTransport("").send(_msg())).ok


def test_brevo_caps():
    c = BrevoTransport("K", daily_quota=300).capabilities()
    assert (c.daily_quota, c.max_batch_size, c.supports_custom_domain) == (300, 1, True)


# ── Settings (R3, R5) ──────────────────────────────────────────────────────

def _settings(**kw):
    return Settings(_env_file=None, hmac_secret_key="h", pii_encryption_key="a" * 64, **kw)


def test_validacion_pool_y_brevo():
    ok = _settings(email_pool="brevo,resend", brevo_api_key="B", brevo_from_email="f@x.com", resend_api_key="R")
    assert ok.email_pool_list == ["brevo", "resend"]
    assert _settings().email_pool_list == []
    with pytest.raises(ValidationError):
        _settings(email_pool="brevo,brevo", brevo_api_key="B", brevo_from_email="f@x.com")  # repetido
    with pytest.raises(ValidationError):
        _settings(email_pool="sendgrid")  # desconocido
    with pytest.raises(ValidationError):
        _settings(email_pool="brevo,resend", brevo_api_key="B", brevo_from_email="f@x.com", resend_api_key="")  # resend sin clave
    with pytest.raises(ValidationError):
        _settings(email_provider="brevo", brevo_api_key="B")  # sin remitente
    assert _settings(email_provider="brevo").email_provider == "brevo"  # dev sin claves


def test_resend_daily_quota_override(monkeypatch):
    monkeypatch.setattr(settings, "resend_platform_plan", "free")
    monkeypatch.setattr(settings, "resend_daily_quota", None)
    assert et.platform_transport_for("resend").capabilities().daily_quota == 100
    monkeypatch.setattr(settings, "resend_daily_quota", 150)
    assert et.platform_transport_for("resend").capabilities().daily_quota == 150


def test_claves_de_cuota_por_proveedor():
    assert platform_quota_key("resend") == "platform"
    assert platform_quota_key("ses") == "platform-ses"
    assert platform_quota_key("brevo") == "platform-brevo"


def test_platform_pool(monkeypatch):
    monkeypatch.setattr(settings, "email_pool", "")
    monkeypatch.setattr(settings, "email_provider", "resend")
    assert [m.name for m in platform_pool()] == ["resend"]
    monkeypatch.setattr(settings, "email_pool", "brevo,resend")
    monkeypatch.setattr(settings, "brevo_daily_quota", 300)
    monkeypatch.setattr(settings, "resend_daily_quota", 150)
    pool = platform_pool()
    assert [(m.name, m.daily_quota, m.quota_key) for m in pool] == [
        ("brevo", 300, "platform-brevo"), ("resend", 150, "platform")]


# ── Reparto en la cola (R6–R9) ─────────────────────────────────────────────

class _FakeDB:
    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)

    async def commit(self): ...

    async def execute(self, *a, **k):
        return types.SimpleNamespace(scalar=lambda: 0)


def _member(name, quota):
    return PoolMember(name, types.SimpleNamespace(name=name), f"k-{name}", quota)


def _setup(monkeypatch, used, n_ids):
    calls = []

    async def fake_usage(key):
        return {"daily_used": used.get(key, 0)}

    async def fake_chunk(db, ids, send, sender, transport, quota_key):
        calls.append((transport.name, list(ids)))
        return len(ids), 0

    monkeypatch.setattr(q, "get_usage", fake_usage)
    monkeypatch.setattr(q, "_send_chunk", fake_chunk)
    ids = [uuid.uuid4() for _ in range(n_ids)]
    batch = SendBatch(id=uuid.uuid4(), signature_ids=[str(i) for i in ids], status="sending")
    send = ScheduledSend(id=uuid.uuid4(), org_id=uuid.uuid4(), sent_count=0, failed_count=0)
    return ids, batch, send, calls


@pytest.mark.asyncio
async def test_reparte_entre_proveedores_en_orden_y_sin_duplicar(monkeypatch):
    ids, batch, send, calls = _setup(monkeypatch, {}, 7)
    db = _FakeDB()
    pool = [_member("brevo", 3), _member("resend", 2)]
    await q._process_claimed_batch(db, batch, send, None, {}, "x", None, pool=pool)

    assert calls == [("brevo", ids[:3]), ("resend", ids[3:5])]
    flat = [i for _n, c in calls for i in c]
    assert len(flat) == len(set(flat)) == 5  # R7: ninguno por dos proveedores
    assert batch.status == "sent" and batch.sent_count == 5 and send.sent_count == 5
    rest = [o for o in db.added if isinstance(o, SendBatch) and o is not batch]
    assert len(rest) == 1 and rest[0].status == "pending"
    assert rest[0].signature_ids == [str(i) for i in ids[5:]]  # el resto, para mañana


@pytest.mark.asyncio
async def test_descuenta_lo_ya_usado_hoy(monkeypatch):
    ids, batch, send, calls = _setup(monkeypatch, {"k-brevo": 3}, 4)  # brevo ya agotado
    await q._process_claimed_batch(_FakeDB(), batch, send, None, {}, "x", None,
                                   pool=[_member("brevo", 3), _member("resend", 10)])
    assert calls == [("resend", ids)]


@pytest.mark.asyncio
async def test_todos_agotados_libera_el_lote(monkeypatch):
    ids, batch, send, calls = _setup(monkeypatch, {"k-brevo": 3, "k-resend": 2}, 4)
    await q._process_claimed_batch(_FakeDB(), batch, send, None, {}, "x", None,
                                   pool=[_member("brevo", 3), _member("resend", 2)])
    assert calls == [] and batch.status == "pending"


@pytest.mark.asyncio
async def test_miembro_sin_tope_toma_el_resto(monkeypatch):
    ids, batch, send, calls = _setup(monkeypatch, {}, 6)
    db = _FakeDB()
    await q._process_claimed_batch(db, batch, send, None, {}, "x", None,
                                   pool=[_member("brevo", 2), _member("resend", None)])
    assert calls == [("brevo", ids[:2]), ("resend", ids[2:])]
    assert not [o for o in db.added if isinstance(o, SendBatch) and o is not batch]


@pytest.mark.asyncio
async def test_sin_pool_comportamiento_de_siempre(monkeypatch):
    ids, batch, send, calls = _setup(monkeypatch, {}, 5)
    tr = types.SimpleNamespace(name="single")
    db = _FakeDB()
    await q._process_claimed_batch(db, batch, send, tr, {}, "k", 3)
    assert calls == [("single", ids[:3])]
    assert [o.signature_ids for o in db.added if isinstance(o, SendBatch) and o is not batch] == [[str(i) for i in ids[3:]]]


# ── Resolución del pool (R6, R8, R9) ───────────────────────────────────────

def _campaign():
    return types.SimpleNamespace(org_id=uuid.uuid4(), meta=None)


@pytest.mark.asyncio
async def test_resolve_pool_org_con_config_propia_no_usa_pool(monkeypatch):
    async def get(db, org_id):
        return types.SimpleNamespace(status="active")

    monkeypatch.setattr(q.OrgEmailConfigService, "get", get)
    monkeypatch.setattr(settings, "email_pool", "brevo,resend")
    assert await q._resolve_pool(None, _campaign()) is None  # R8


@pytest.mark.asyncio
async def test_resolve_pool_plataforma_y_cupo_total(monkeypatch):
    async def get(db, org_id):
        return None

    monkeypatch.setattr(q.OrgEmailConfigService, "get", get)
    monkeypatch.setattr(settings, "brevo_daily_quota", 300)
    monkeypatch.setattr(settings, "resend_daily_quota", 150)
    monkeypatch.setattr(settings, "email_pool", "")
    assert await q._resolve_pool(None, _campaign()) is None  # un solo miembro: camino de siempre
    monkeypatch.setattr(settings, "email_pool", "brevo,resend")
    assert [m.name for m in await q._resolve_pool(None, _campaign())] == ["brevo", "resend"]
    _t, _s, _k, daily = await q._resolve_email_context(None, _campaign(), None)
    assert daily == 450  # R9: suma de cupos del pool
