"""Suite de validacion-cedula (T5): gate de create_signature por location_mode.

Complementa test_cedula.py (T4, unidad de verify_cedula) con la integración
real contra la base de datos: firma nacional con cédula inválida/ausente
debe fallar, nacional con cédula válida debe crear la firma, e internacional
con identificación libre debe aceptarse sin validar formato (R5, R6)."""
import uuid

import pytest
from sqlalchemy import delete, text

from app.crypto import compute_hmac
from app.database import AsyncSessionLocal
from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.organization import Organization
from app.models.signature import Signature
from app.models.user import User
from app.schemas.signature import SignatureCreate
from app.services.signature_service import create_signature

# Cédula matemáticamente válida (Pichincha) reutilizada de test_cedula.py
CEDULA_VALIDA = "1710034065"
IP_HMAC = compute_hmac("127.0.0.1")


@pytest.fixture
async def db():
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        yield session


async def _make_org(db) -> tuple[Organization, User]:
    suffix = uuid.uuid4().hex[:8]
    org = Organization(
        name=f"Org Cedula {suffix}", slug=f"org-cedula-{suffix}",
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
        title=f"Campaña Cédula {suffix}", slug=f"camp-cedula-{suffix}", status="active",
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def _cleanup(db, org, user, campaign):
    sig_ids = [row[0] for row in (await db.execute(
        text("SELECT id FROM signatures WHERE campaign_id = :cid"), {"cid": str(campaign.id)}
    )).all()]
    if sig_ids:
        await db.execute(delete(Consent).where(Consent.signature_id.in_(sig_ids)))
        await db.execute(delete(Signature).where(Signature.campaign_id == campaign.id))
    await db.execute(delete(Campaign).where(Campaign.id == campaign.id))
    await db.execute(delete(User).where(User.id == user.id))
    await db.execute(delete(Organization).where(Organization.id == org.id))
    await db.commit()


def _signature_data(**overrides) -> SignatureCreate:
    base = dict(
        name="Firmante Prueba",
        email=f"{uuid.uuid4().hex[:8]}@test.local",
        cedula=None,
        location_mode="nacional",
        provincia="Pichincha",
        visibility="anonima",
        consent=True,
    )
    base.update(overrides)
    return SignatureCreate(**base)


@pytest.mark.asyncio
async def test_nacional_cedula_ausente_es_requerida(db):
    """R5: form_config por defecto exige cédula para location_mode nacional."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        with pytest.raises(ValueError, match="cedula_requerida"):
            await create_signature(db, camp, _signature_data(cedula=None), IP_HMAC)
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_nacional_cedula_invalida_es_rechazada(db):
    """R1-R5: dígito verificador incorrecto → cedula_invalida."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    invalida = CEDULA_VALIDA[:9] + str((int(CEDULA_VALIDA[9]) + 1) % 10)
    try:
        with pytest.raises(ValueError, match="cedula_invalida"):
            await create_signature(db, camp, _signature_data(cedula=invalida), IP_HMAC)
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_nacional_cedula_valida_crea_la_firma(db):
    """R1-R5: cédula matemáticamente válida → la firma se persiste."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        sig = await create_signature(db, camp, _signature_data(cedula=CEDULA_VALIDA), IP_HMAC)
        assert sig.status == "pending_confirmation"
        assert sig.cedula_hash == compute_hmac(CEDULA_VALIDA)
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_internacional_identificacion_libre_se_acepta(db):
    """R6: location_mode internacional acepta cualquier identificación sin validar formato."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        sig = await create_signature(
            db, camp,
            _signature_data(
                cedula="ID-EXTRANJERA-000",
                location_mode="internacional",
                provincia=None,
                country="Colombia",
            ),
            IP_HMAC,
        )
        assert sig.status == "pending_confirmation"
        assert sig.country == "Colombia"
    finally:
        await _cleanup(db, org, user, camp)
