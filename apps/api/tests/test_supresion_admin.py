"""Tests de supresion-admin (R11): archivar, exclusiones, restaurar, purga, permisos."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import delete, select, text

from app.crypto import compute_hmac, encrypt_pii
from app.database import AsyncSessionLocal
from app.dependencies import get_current_user, get_db_with_org
from app.main import app
from app.models.arco_request import ArcoRequest
from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.organization import Organization
from app.models.signature import Signature
from app.models.user import User
from app.services.admin_signature_service import AdminSignatureService
from app.services.campaign_service import CampaignService
from app.services.retention_service import run_retention
from app.services.signature_service import get_recent_signatures


@pytest.fixture
async def db():
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        yield session


async def _make_org_campaign(db) -> tuple[Organization, User, Campaign]:
    suffix = uuid.uuid4().hex[:8]
    org = Organization(
        name=f"Org Test {suffix}",
        slug=f"org-test-{suffix}",
        status="verificada",
        contact_email=f"contacto-{suffix}@test.local",
    )
    db.add(org)
    await db.flush()

    admin_user = User(org_id=org.id, email=f"admin-{suffix}@test.local", password_hash="x", role="admin")
    db.add(admin_user)
    await db.flush()

    campaign = Campaign(org_id=org.id, created_by=admin_user.id, title=f"Campaña {suffix}", slug=f"camp-{suffix}", status="active")
    db.add(campaign)
    await db.commit()
    return org, admin_user, campaign


async def _make_signature(db, campaign: Campaign, org: Organization, *, visibility: str = "publica") -> Signature:
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
        provincia="Pichincha",
        country="Ecuador",
        visibility=visibility,
        status="confirmed",
        confirmed_at=datetime.now(timezone.utc),
        ip_hmac=compute_hmac("127.0.0.1"),
        confirmation_token=uuid.uuid4().hex,
    )
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
        notify_updates=True,
    )
    db.add(consent)
    await db.commit()
    await db.refresh(sig)
    return sig


async def _cleanup(db, campaign: Campaign, org: Organization, user: User) -> None:
    sig_ids_result = await db.execute(select(Signature.id).where(Signature.campaign_id == campaign.id))
    sig_ids = [row[0] for row in sig_ids_result.all()]
    await db.execute(delete(Consent).where(Consent.campaign_id == campaign.id))
    await db.execute(delete(Signature).where(Signature.campaign_id == campaign.id))
    await db.execute(delete(ArcoRequest).where(ArcoRequest.campaign_id == campaign.id))
    await db.execute(delete(Campaign).where(Campaign.id == campaign.id))
    await db.execute(delete(User).where(User.id == user.id))
    await db.execute(delete(Organization).where(Organization.id == org.id))
    await db.commit()


@pytest.mark.asyncio
async def test_archivar_marca_columnas_y_auditoria(db):
    org, user, campaign = await _make_org_campaign(db)
    try:
        sig = await _make_signature(db, campaign, org)

        purge_after = await AdminSignatureService.archive_signature(db, sig, user.id)

        await db.refresh(sig)
        assert sig.archived_at is not None
        assert sig.archived_by == user.id
        assert sig.purge_after == purge_after
        assert purge_after - sig.archived_at == timedelta(days=15)
        assert sig.status == "confirmed"  # sigue contando (R2)

        arco_result = await db.execute(
            select(ArcoRequest).where(ArcoRequest.campaign_id == campaign.id, ArcoRequest.email_hash == sig.email_hash)
        )
        arco = arco_result.scalar_one()
        assert arco.right_type == "supresion"
        assert arco.result == "completed"
        assert arco.detail["trigger"] == "admin"
        assert arco.detail["admin_id"] == str(user.id)
        assert "@" not in str(arco.detail)  # sin PII
    finally:
        await _cleanup(db, campaign, org, user)


@pytest.mark.asyncio
async def test_exclusiones_archivada_fuera_de_export_notify_y_feed(db):
    org, user, campaign = await _make_org_campaign(db)
    try:
        sig = await _make_signature(db, campaign, org)
        await AdminSignatureService.archive_signature(db, sig, user.id)

        recent = await get_recent_signatures(db, campaign.id)
        assert len(recent) == 0

        emails = await CampaignService.get_signer_emails_for_notify(db, campaign.id)
        assert emails == []

        response = await AdminSignatureService.export_csv(db, campaign_id=campaign.id, org_id=None, slug=campaign.slug)
        csv_text = "".join([chunk async for chunk in response.body_iterator])
        assert str(sig.id) not in csv_text
    finally:
        await _cleanup(db, campaign, org, user)


@pytest.mark.asyncio
async def test_restaurar_dentro_de_ventana(db):
    org, user, campaign = await _make_org_campaign(db)
    try:
        sig = await _make_signature(db, campaign, org)
        await AdminSignatureService.archive_signature(db, sig, user.id)

        await AdminSignatureService.unarchive_signature(db, sig, user.id)

        await db.refresh(sig)
        assert sig.archived_at is None
        assert sig.archived_by is None
        assert sig.purge_after is None

        arco_result = await db.execute(
            select(ArcoRequest).where(ArcoRequest.campaign_id == campaign.id, ArcoRequest.email_hash == sig.email_hash)
        )
        arco = arco_result.scalar_one()
        assert "reverted_at" in arco.detail
        assert arco.detail["reverted_by"] == str(user.id)
    finally:
        await _cleanup(db, campaign, org, user)


@pytest.mark.asyncio
async def test_purga_anonimiza_y_conteo_intacto(db):
    org, user, campaign = await _make_org_campaign(db)
    try:
        sig = await _make_signature(db, campaign, org)
        await AdminSignatureService.archive_signature(db, sig, user.id)
        # Forzar vencimiento de la ventana
        sig.purge_after = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.commit()

        count_before = await CampaignService.list_with_counts(db, None)
        confirmed_before = next(c["confirmed_signatures"] for c in count_before if c["id"] == str(campaign.id))

        run = await run_retention(db, trigger="manual")

        await db.refresh(sig)
        assert sig.anonymized_at is not None
        assert sig.name is None
        assert sig.email_encrypted == "anonymized"
        assert sig.status == "confirmed"  # el conteo no cambia (R9)
        assert any(d.get("archived_purge_count", 0) >= 1 for d in run.detail)

        count_after = await CampaignService.list_with_counts(db, None)
        confirmed_after = next(c["confirmed_signatures"] for c in count_after if c["id"] == str(campaign.id))
        assert confirmed_after == confirmed_before
    finally:
        await _cleanup(db, campaign, org, user)


@pytest.mark.asyncio
async def test_purga_es_idempotente(db):
    org, user, campaign = await _make_org_campaign(db)
    try:
        sig = await _make_signature(db, campaign, org)
        await AdminSignatureService.archive_signature(db, sig, user.id)
        sig.purge_after = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.commit()

        await run_retention(db, trigger="manual")
        await db.refresh(sig)
        first_anonymized_at = sig.anonymized_at

        run2 = await run_retention(db, trigger="manual")
        await db.refresh(sig)
        assert sig.anonymized_at == first_anonymized_at
        assert not any(d.get("archived_purge_count") for d in run2.detail)
    finally:
        await _cleanup(db, campaign, org, user)


@pytest.mark.asyncio
async def test_no_se_puede_restaurar_tras_purga(db):
    org, user, campaign = await _make_org_campaign(db)
    try:
        sig = await _make_signature(db, campaign, org)
        await AdminSignatureService.archive_signature(db, sig, user.id)
        sig.purge_after = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.commit()

        await run_retention(db, trigger="manual")
        await db.refresh(sig)
        assert sig.anonymized_at is not None

        with pytest.raises(ValueError):
            await AdminSignatureService.unarchive_signature(db, sig, user.id)
    finally:
        await _cleanup(db, campaign, org, user)


class _FakeAdminUser:
    id = uuid.uuid4()
    role = "admin"
    org_id = uuid.uuid4()


class _FakeGestorUser:
    id = uuid.uuid4()
    role = "gestor"
    org_id = uuid.uuid4()


@pytest.mark.asyncio
async def test_endpoint_archive_403_sin_rol_admin(client):
    app.dependency_overrides[get_current_user] = lambda: _FakeGestorUser()
    try:
        response = await client.post(f"/v1/admin/campaigns/{uuid.uuid4()}/signatures/{uuid.uuid4()}/archive")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_endpoint_archive_401_sin_jwt(client):
    response = await client.post(f"/v1/admin/campaigns/{uuid.uuid4()}/signatures/{uuid.uuid4()}/archive")
    assert response.status_code == 401
