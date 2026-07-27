"""Tests de config-email-org (Fase 1): cifrado de credenciales + abstracción de
transporte (adaptador Resend, resolución/fallback, capacidades)."""
import json
from types import SimpleNamespace

import pytest

from app.crypto import PIIDecryptError, decrypt_secret, encrypt_secret
from app.redis_client import close_redis, init_redis
from app.services.email_transport import (
    EmailMessage,
    ResendTransport,
    platform_transport,
    transport_from_config,
)


def test_encrypt_decrypt_secret_roundtrip():
    """R3: el secreto se cifra (sec:v1:) y se recupera intacto."""
    secret = json.dumps({"api_key": "re_live_abc123"})
    token = encrypt_secret(secret)
    assert token.startswith("sec:v1:")
    assert secret not in token  # no en claro
    assert decrypt_secret(token) == secret


def test_decrypt_secret_rechaza_formato_invalido():
    with pytest.raises(PIIDecryptError):
        decrypt_secret("texto-plano-no-cifrado")


def test_transport_from_config_resend_usa_credenciales():
    """La config de la org instancia Resend con SU api_key + plan (R2, R6)."""
    cfg = SimpleNamespace(
        provider="resend",
        credentials_encrypted=encrypt_secret(json.dumps({"api_key": "re_test_org"})),
        plan="pro",
        org_id="org-x",
    )
    tr = transport_from_config(cfg)
    assert isinstance(tr, ResendTransport)
    assert tr._api_key == "re_test_org"
    caps = tr.capabilities()
    assert caps.monthly_quota == 50000  # pro
    assert caps.daily_quota is None  # sin límite diario en pro


def test_transport_from_config_sin_credenciales_cae_a_plataforma():
    """Config sin credenciales → transporte de plataforma (defensivo, R5)."""
    cfg = SimpleNamespace(provider="resend", credentials_encrypted=None, plan=None, org_id="org-x")
    tr = transport_from_config(cfg)
    assert isinstance(tr, ResendTransport)


def test_transport_from_config_proveedor_desconocido_cae_a_plataforma():
    cfg = SimpleNamespace(
        provider="sendgrid",  # no registrado en Fase 1
        credentials_encrypted=encrypt_secret(json.dumps({"api_key": "x"})),
        plan=None, org_id="org-x",
    )
    tr = transport_from_config(cfg)
    assert isinstance(tr, ResendTransport)  # fallback plataforma


def test_capabilities_free_vs_pro():
    assert ResendTransport("k", plan="free").capabilities().daily_quota == 100
    assert ResendTransport("k", plan="pro").capabilities().daily_quota is None
    # Plan desconocido/None → asume free (conservador)
    assert ResendTransport("k", plan=None).capabilities().daily_quota == 100


@pytest.mark.asyncio
async def test_resend_transport_dev_sin_apikey_no_falla():
    """Sin api_key (modo dev) el envío no golpea la red y reporta ok."""
    tr = ResendTransport("")
    r = await tr.send(EmailMessage(to=["a@b.com"], subject="s", html="<p>x</p>", from_="noreply@cauce.ec"))
    assert r.ok is True


def test_platform_transport_es_resend():
    assert isinstance(platform_transport(), ResendTransport)


# ── resolve_sender: herencia campaña→org→plataforma + validación de dominio ──

from app.services.email_transport import resolve_sender  # noqa: E402


def test_resolve_sender_hereda_de_org():
    org_cfg = SimpleNamespace(default_from="hola@acme.org", default_display_name="Acme",
                              default_reply_to="reply@acme.org", allowed_domains=["acme.org"])
    org = SimpleNamespace(name="Acme Org", contact_email="c@acme.org")
    s = resolve_sender({}, org_cfg, org)
    assert s["from_"] == "Acme <hola@acme.org>"
    assert s["reply_to"] == "reply@acme.org"


def test_resolve_sender_campana_override_en_dominio_permitido():
    org_cfg = SimpleNamespace(default_from="hola@acme.org", default_display_name="Acme",
                              default_reply_to=None, allowed_domains=["acme.org"])
    meta = {"sender_from": "campaña@acme.org", "sender_display_name": "Campaña X"}
    s = resolve_sender(meta, org_cfg, SimpleNamespace(name="Acme", contact_email=None))
    assert s["from_"] == "Campaña X <campaña@acme.org>"


def test_resolve_sender_degrada_si_dominio_no_permitido():
    org_cfg = SimpleNamespace(default_from="hola@acme.org", default_display_name="Acme",
                              default_reply_to=None, allowed_domains=["acme.org"])
    meta = {"sender_from": "spoof@otro.com"}  # dominio no permitido → degrada
    s = resolve_sender(meta, org_cfg, SimpleNamespace(name="Acme", contact_email=None))
    assert "acme.org" in s["from_"]
    assert "otro.com" not in s["from_"]


def test_resolve_sender_sin_config_usa_plataforma_y_nombre_org():
    from app.config import settings
    org = SimpleNamespace(name="Acme", contact_email="c@acme.org")
    s = resolve_sender({}, None, org)
    assert settings.resend_from_email in s["from_"]
    assert s["from_"].startswith("Acme <")


# ── Service con DB (cifrado en reposo, no-exposición, RLS platform_admin) ──

import uuid  # noqa: E402

from sqlalchemy import delete as sa_delete, select, text  # noqa: E402

from app.database import AsyncSessionLocal  # noqa: E402
from app.models.org_email_config import OrgEmailConfig  # noqa: E402
from app.models.organization import Organization  # noqa: E402
from app.schemas.org_email_config import OrgEmailConfigUpdate  # noqa: E402
from app.schemas.organization import OrganizationCreate  # noqa: E402
from app.services.org_email_config_service import OrgEmailConfigService, to_response  # noqa: E402
from app.services.organization_service import OrganizationService  # noqa: E402


@pytest.fixture
async def db():
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        yield session


async def _make_org(db) -> Organization:
    suffix = uuid.uuid4().hex[:8]
    org = Organization(name=f"Org Email {suffix}", slug=f"org-email-{suffix}", status="verificada")
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


@pytest.mark.asyncio
async def test_upsert_cifra_credenciales_y_no_las_expone(db):
    """R3: la credencial se guarda cifrada (sec:v1:) y la respuesta no la expone."""
    org = await _make_org(db)
    await init_redis()  # to_response lee el contador de cuota (R7)
    try:
        data = OrgEmailConfigUpdate(provider="resend", api_key="re_secreta_123", plan="pro",
                                    default_from="hola@acme.org", allowed_domains=["acme.org"])
        cfg = await OrgEmailConfigService.upsert(db, org.id, data, created_by=None)
        assert cfg.credentials_encrypted.startswith("sec:v1:")
        assert "re_secreta_123" not in cfg.credentials_encrypted
        resp = await to_response(cfg)
        assert resp.has_credentials is True
        assert resp.daily_used == 0
        # el schema de respuesta no tiene ningún campo de credencial
        assert "re_secreta_123" not in resp.model_dump_json()
        # update sin api_key conserva la credencial existente
        cfg2 = await OrgEmailConfigService.upsert(
            db, org.id, OrgEmailConfigUpdate(provider="resend", plan="free"), created_by=None)
        assert cfg2.credentials_encrypted == cfg.credentials_encrypted
        assert cfg2.plan == "free"
    finally:
        await close_redis()
        await db.execute(sa_delete(OrgEmailConfig).where(OrgEmailConfig.org_id == org.id))
        await db.execute(sa_delete(Organization).where(Organization.id == org.id))
        await db.commit()


@pytest.mark.asyncio
async def test_alta_de_organizacion_materializa_email_config(db):
    """R2b/D4: crear una org materializa su org_email_config (provider default
    Resend, dominio declarado en allowed_domains), sin credenciales ni
    default_from (cae al default de plataforma hasta que se configure)."""
    suffix = uuid.uuid4().hex[:8]
    data = OrganizationCreate(
        name=f"Org Alta {suffix}", slug=f"org-alta-{suffix}", domain="acme.org",
    )
    org = await OrganizationService.create_organization(db, data)
    try:
        cfg = await OrgEmailConfigService.get(db, org.id)
        assert cfg is not None
        assert cfg.provider == "resend"
        assert cfg.allowed_domains == ["acme.org"]
        assert cfg.credentials_encrypted is None
        assert cfg.default_from is None
    finally:
        await db.execute(sa_delete(OrgEmailConfig).where(OrgEmailConfig.org_id == org.id))
        await db.execute(sa_delete(Organization).where(Organization.id == org.id))
        await db.commit()


@pytest.mark.asyncio
async def test_get_y_delete(db):
    org = await _make_org(db)
    try:
        await OrgEmailConfigService.upsert(
            db, org.id, OrgEmailConfigUpdate(provider="resend", api_key="k"), created_by=None)
        assert await OrgEmailConfigService.get(db, org.id) is not None
        assert await OrgEmailConfigService.delete(db, org.id) is True
        assert await OrgEmailConfigService.get(db, org.id) is None
        assert await OrgEmailConfigService.delete(db, org.id) is False
    finally:
        await db.execute(sa_delete(OrgEmailConfig).where(OrgEmailConfig.org_id == org.id))
        await db.execute(sa_delete(Organization).where(Organization.id == org.id))
        await db.commit()
