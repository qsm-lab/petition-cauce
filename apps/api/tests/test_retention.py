"""Tests de retencion-datos (R11): ancla, anonimización, idempotencia, auditoría, endpoint."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import delete, select, text

from app.crypto import compute_hmac, encrypt_pii
from app.database import AsyncSessionLocal
from app.dependencies import get_db, get_current_user
from app.main import app
from app.redis_client import close_redis, init_redis
from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.lifecycle_event import LifecycleEvent
from app.models.organization import Organization
from app.models.privacy_config import PrivacyConfig
from app.models.signature import Signature
from app.models.user import User
from app.services.retention_service import compute_expiry, get_campaign_anchor, run_retention


@pytest.fixture
async def db():
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        yield session


async def _make_org_campaign(db, retention_days: int = 365) -> tuple[Organization, User, Campaign]:
    suffix = uuid.uuid4().hex[:8]
    org = Organization(name=f"Org Test {suffix}", slug=f"org-test-{suffix}", status="verificada")
    db.add(org)
    await db.flush()

    user = User(org_id=org.id, email=f"user-{suffix}@test.local", password_hash="x", role="admin")
    db.add(user)
    await db.flush()

    campaign = Campaign(org_id=org.id, created_by=user.id, title=f"Campaña {suffix}", slug=f"camp-{suffix}", status="active")
    db.add(campaign)
    await db.flush()

    privacy_config = PrivacyConfig(
        campaign_id=campaign.id,
        aviso_privacidad="aviso de prueba",
        base_legal="consentimiento_expreso",
        retention_days=retention_days,
    )
    db.add(privacy_config)
    await db.commit()
    return org, user, campaign


async def _make_signature(db, campaign: Campaign, org: Organization, *, created_at: datetime | None = None) -> Signature:
    suffix = uuid.uuid4().hex[:8]
    email = f"firmante-{suffix}@test.local"
    sig = Signature(
        campaign_id=campaign.id,
        org_id=org.id,
        name="Firmante Test",
        email_encrypted=encrypt_pii(email),
        email_hash=compute_hmac(email),
        cedula_encrypted=encrypt_pii("1710034065"),
        cedula_hash=compute_hmac("1710034065"),
        celular_encrypted=encrypt_pii("0991234567"),
        provincia="Pichincha",
        country="Ecuador",
        visibility="publica",
        status="confirmed",
        confirmed_at=datetime.now(timezone.utc),
        ip_hmac=compute_hmac("127.0.0.1"),
        confirmation_token=uuid.uuid4().hex,
    )
    if created_at is not None:
        sig.created_at = created_at
    db.add(sig)
    await db.flush()

    consent = Consent(
        signature_id=sig.id,
        campaign_id=campaign.id,
        org_id=org.id,
        text_snapshot="texto del aviso visto por el firmante",
        version="1",
        legal_basis="consentimiento_expreso",
        ip_hmac=compute_hmac("127.0.0.1"),
    )
    db.add(consent)
    await db.commit()
    await db.refresh(sig)
    return sig


async def _cleanup(db, campaign: Campaign, org: Organization, user: User) -> None:
    await db.execute(delete(Consent).where(Consent.campaign_id == campaign.id))
    await db.execute(delete(Signature).where(Signature.campaign_id == campaign.id))
    await db.execute(delete(LifecycleEvent).where(LifecycleEvent.campaign_id == campaign.id))
    await db.execute(delete(PrivacyConfig).where(PrivacyConfig.campaign_id == campaign.id))
    await db.execute(delete(Campaign).where(Campaign.id == campaign.id))
    await db.execute(delete(User).where(User.id == user.id))
    await db.execute(delete(Organization).where(Organization.id == org.id))
    await db.commit()


def test_compute_expiry():
    anchor = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert compute_expiry(anchor, 30) == datetime(2026, 1, 31, tzinfo=timezone.utc)


@pytest.mark.asyncio
async def test_ancla_usa_evento_entrega_si_existe(db):
    org, user, campaign = await _make_org_campaign(db)
    try:
        entrega_date = datetime(2026, 3, 1, tzinfo=timezone.utc)
        event = LifecycleEvent(campaign_id=campaign.id, stage="entrega", stage_index=2, registered_at=entrega_date)
        db.add(event)
        await db.commit()

        anchor = await get_campaign_anchor(db, campaign.id)
        assert anchor == entrega_date
    finally:
        await _cleanup(db, campaign, org, user)


@pytest.mark.asyncio
async def test_ancla_sin_evento_entrega_es_none(db):
    """Sin evento 'entrega' el ancla es None — run_retention usa created_at de cada firma (R2)."""
    org, user, campaign = await _make_org_campaign(db)
    try:
        anchor = await get_campaign_anchor(db, campaign.id)
        assert anchor is None
    finally:
        await _cleanup(db, campaign, org, user)


@pytest.mark.asyncio
async def test_anonimizacion_completa_preserva_campos_agregables(db):
    org, user, campaign = await _make_org_campaign(db, retention_days=0)
    try:
        old_date = datetime.now(timezone.utc) - timedelta(days=1)
        sig = await _make_signature(db, campaign, org, created_at=old_date)

        run = await run_retention(db, trigger="manual")

        await db.refresh(sig)
        assert sig.anonymized_at is not None
        assert sig.name is None
        assert sig.org_name is None
        assert sig.org_name_hash is None
        assert sig.cedula_encrypted is None
        assert sig.cedula_hash is None
        assert sig.celular_encrypted is None
        assert sig.ip_hmac is None
        assert sig.confirmation_token is None
        assert sig.email_encrypted == "anonymized"
        assert sig.email_hash.startswith("anonymized:")

        # Campos agregables no identificantes intactos (R4): el conteo histórico no cambia
        assert sig.status == "confirmed"
        assert sig.visibility == "publica"
        assert sig.provincia == "Pichincha"
        assert sig.country == "Ecuador"
        assert sig.confirmed_at is not None
        assert sig.created_at == old_date

        consent = (await db.execute(select(Consent).where(Consent.signature_id == sig.id))).scalar_one()
        assert consent.ip_hmac is None
        assert consent.text_snapshot == "texto del aviso visto por el firmante"  # prueba de consentimiento (R5)

        assert run.signatures_anonymized == 1
        assert {"campaign_id": str(campaign.id), "anonymized_count": 1} in run.detail
    finally:
        await _cleanup(db, campaign, org, user)


@pytest.mark.asyncio
async def test_idempotencia_no_reprocesa_firmas_anonimizadas(db):
    org, user, campaign = await _make_org_campaign(db, retention_days=0)
    try:
        old_date = datetime.now(timezone.utc) - timedelta(days=1)
        sig = await _make_signature(db, campaign, org, created_at=old_date)

        await run_retention(db, trigger="manual")
        await db.refresh(sig)
        first_anonymized_at = sig.anonymized_at
        first_email_hash = sig.email_hash

        run2 = await run_retention(db, trigger="manual")

        await db.refresh(sig)
        assert sig.anonymized_at == first_anonymized_at
        assert sig.email_hash == first_email_hash
        assert run2.signatures_anonymized == 0
    finally:
        await _cleanup(db, campaign, org, user)


@pytest.mark.asyncio
async def test_auditoria_registra_conteos_sin_pii(db):
    org, user, campaign = await _make_org_campaign(db, retention_days=0)
    try:
        old_date = datetime.now(timezone.utc) - timedelta(days=1)
        await _make_signature(db, campaign, org, created_at=old_date)

        run = await run_retention(db, trigger="manual")

        assert run.trigger == "manual"
        assert run.finished_at is not None
        assert run.campaigns_evaluated >= 1
        assert run.signatures_anonymized >= 1
        detail_str = str(run.detail)
        assert "@" not in detail_str  # sin email
        assert "1710034065" not in detail_str  # sin cédula
    finally:
        await _cleanup(db, campaign, org, user)


class _FakeAdminUser:
    role = "admin"


class _FakeGestorUser:
    role = "gestor"


@pytest.mark.asyncio
async def test_endpoint_manual_403_sin_rol_admin(client):
    async def _fake_db():
        async with AsyncSessionLocal() as session:
            yield session

    app.dependency_overrides[get_current_user] = lambda: _FakeGestorUser()
    app.dependency_overrides[get_db] = _fake_db
    try:
        response = await client.post("/v1/admin/retention/run")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_endpoint_manual_200_con_rol_admin(client):
    async def _fake_db():
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
            yield session

    app.dependency_overrides[get_current_user] = lambda: _FakeAdminUser()
    app.dependency_overrides[get_db] = _fake_db
    await init_redis()
    try:
        response = await client.post("/v1/admin/retention/run")
        assert response.status_code == 200
        data = response.json()
        assert data["trigger"] == "manual"
        assert "signatures_anonymized" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)
        await close_redis()
