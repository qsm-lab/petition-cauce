"""Tests de embudo-post-firma: set_newsletter_consent (consentimiento de
Anuncios post-firma autorizado por newsletter_token)."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import delete, select, text

from app.crypto import compute_hmac, encrypt_pii
from app.database import AsyncSessionLocal
from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.organization import Organization
from app.models.signature import Signature
from app.models.user import User
from app.services.signature_service import set_newsletter_consent


@pytest.fixture
async def db():
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        yield session


async def _make_org(db) -> tuple[Organization, User]:
    suffix = uuid.uuid4().hex[:8]
    org = Organization(
        name=f"Org Embudo {suffix}", slug=f"org-embudo-{suffix}",
        status="verificada", contact_email=f"contacto-{suffix}@test.local",
    )
    db.add(org)
    await db.flush()
    user = User(org_id=org.id, email=f"admin-{suffix}@test.local", password_hash="x", role="admin")
    db.add(user)
    await db.commit()
    return org, user


async def _make_campaign(db, org: Organization, user: User) -> Campaign:
    suffix = uuid.uuid4().hex[:8]
    campaign = Campaign(
        org_id=org.id, created_by=user.id,
        title=f"Campaña Embudo {suffix}", slug=f"camp-embudo-{suffix}", status="active",
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def _make_signature_with_token(
    db, campaign: Campaign, org: Organization, *,
    token: str, token_expires_at: datetime, status: str = "pending_confirmation",
) -> Signature:
    email = f"{uuid.uuid4().hex[:8]}@test.local"
    sig = Signature(
        campaign_id=campaign.id, org_id=org.id, name="Firmante Embudo",
        email_encrypted=encrypt_pii(email), email_hash=compute_hmac(email),
        visibility="anonima", status=status,
        newsletter_token=token, newsletter_token_expires_at=token_expires_at,
        confirmation_token=uuid.uuid4().hex, ip_hmac=compute_hmac("127.0.0.1"),
    )
    db.add(sig)
    await db.flush()
    consent = Consent(
        signature_id=sig.id, campaign_id=campaign.id, org_id=org.id,
        text_snapshot="aviso", version="1", legal_basis="consentimiento_expreso",
        notify_updates=False, subscribe_newsletter=False,
    )
    db.add(consent)
    await db.commit()
    await db.refresh(sig)
    return sig


async def _consent_of(db, sig_id) -> Consent:
    r = await db.execute(select(Consent).where(Consent.signature_id == sig_id))
    return r.scalar_one()


async def _cleanup(db, org, user, campaign):
    sig_ids = [row[0] for row in (await db.execute(
        select(Signature.id).where(Signature.campaign_id == campaign.id))).all()]
    await db.execute(delete(Consent).where(Consent.signature_id.in_(sig_ids)))
    await db.execute(delete(Signature).where(Signature.campaign_id == campaign.id))
    await db.execute(delete(Campaign).where(Campaign.id == campaign.id))
    await db.execute(delete(User).where(User.id == user.id))
    await db.execute(delete(Organization).where(Organization.id == org.id))
    await db.commit()


@pytest.mark.asyncio
async def test_activa_setea_notify_updates_y_timestamp(db):
    """R1, R11: token válido → notify_updates=True + notify_updates_at; sin tocar status (R8)."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    token = uuid.uuid4().hex
    sig = await _make_signature_with_token(
        db, camp, org, token=token, token_expires_at=datetime.now(timezone.utc) + timedelta(hours=2))
    try:
        ok = await set_newsletter_consent(db, token, True)
        assert ok is True
        consent = await _consent_of(db, sig.id)
        assert consent.notify_updates is True
        assert consent.notify_updates_at is not None
        # No cambia el status de la firma (R8)
        await db.refresh(sig)
        assert sig.status == "pending_confirmation"
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_desactiva_e_idempotente(db):
    """R2, R7: desmarcar persiste False; reenviar el mismo valor no falla."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    token = uuid.uuid4().hex
    sig = await _make_signature_with_token(
        db, camp, org, token=token, token_expires_at=datetime.now(timezone.utc) + timedelta(hours=2))
    try:
        assert await set_newsletter_consent(db, token, True) is True
        assert await set_newsletter_consent(db, token, False) is True
        assert await set_newsletter_consent(db, token, False) is True  # idempotente
        consent = await _consent_of(db, sig.id)
        assert consent.notify_updates is False
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_token_invalido_no_aplica(db):
    """R5, R6: token inexistente → False, sin efecto."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    sig = await _make_signature_with_token(
        db, camp, org, token=uuid.uuid4().hex,
        token_expires_at=datetime.now(timezone.utc) + timedelta(hours=2))
    try:
        assert await set_newsletter_consent(db, "token-que-no-existe", True) is False
        consent = await _consent_of(db, sig.id)
        assert consent.notify_updates is False
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_token_expirado_no_aplica(db):
    """El token vencido no autoriza el cambio."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    token = uuid.uuid4().hex
    sig = await _make_signature_with_token(
        db, camp, org, token=token, token_expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    try:
        assert await set_newsletter_consent(db, token, True) is False
        consent = await _consent_of(db, sig.id)
        assert consent.notify_updates is False
    finally:
        await _cleanup(db, org, user, camp)
