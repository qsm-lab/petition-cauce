"""Tests de centro-comunicaciones Fase 1: sanitización (R6) y segmentación
por clase LOPDP (R8-R11) — sin transporte real (ver test_comms_send.py para
el envío, con transporte falso)."""
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import delete, text

from app.crypto import compute_hmac, encrypt_pii
from app.database import AsyncSessionLocal
from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.organization import Organization
from app.models.signature import Signature
from app.models.user import User
from app.services.comms_service import (
    AudienceFilter, CtaButton, InvalidCommsType, build_comms_email_html,
    build_segment_filters, count_recipients, get_recipients, sanitize_comms_html,
)


# ── Sanitización (R6) ─────────────────────────────────────────────────────

def test_sanitiza_script_y_preserva_tags_permitidos():
    html = "<p>Hola <strong>mundo</strong></p><script>alert(1)</script>"
    out = sanitize_comms_html(html)
    assert "<script>" not in out
    assert "alert" not in out
    assert "<p>Hola <strong>mundo</strong></p>" in out


def test_sanitiza_atributos_peligrosos():
    html = '<a href="javascript:alert(1)">click</a><p onclick="alert(1)">x</p>'
    out = sanitize_comms_html(html)
    assert "javascript:" not in out
    assert "onclick" not in out


def test_sanitiza_img_src_fuera_del_dominio_de_uploads():
    html = '<img src="https://evil.com/tracker.png">'
    out = sanitize_comms_html(html)
    assert "evil.com" not in out


def test_html_vacio_no_falla():
    assert sanitize_comms_html("") == ""
    assert sanitize_comms_html(None) == ""


def test_tipo_invalido_lanza_error():
    with pytest.raises(InvalidCommsType):
        build_segment_filters(uuid.uuid4(), "no-existe", AudienceFilter())


# ── Armado de HTML (CTA, redes, plantilla) ────────────────────────────────

def test_cta_deshabilitado_no_se_renderiza():
    html = build_comms_email_html(
        org_name="Acme", heading="Titulo", body_html="<p>x</p>",
        ctas=[CtaButton(text="Firma", url="cauce.ec", enabled=False)],
    )
    assert "Firma" not in html


def test_cta_habilitado_normaliza_url_sin_esquema():
    html = build_comms_email_html(
        org_name="Acme", heading="Titulo", body_html="<p>x</p>",
        ctas=[CtaButton(text="Firma", url="cauce.ec/accion", enabled=True)],
    )
    assert 'href="https://cauce.ec/accion"' in html
    assert "Firma" in html


def test_redes_sociales_toggle():
    social = {"instagram": "https://instagram.com/x", "facebook": "https://facebook.com/x"}
    con_redes = build_comms_email_html(
        org_name="Acme", heading="T", body_html="<p>x</p>", include_social=True, social_links=social,
    )
    sin_redes = build_comms_email_html(
        org_name="Acme", heading="T", body_html="<p>x</p>", include_social=False, social_links=social,
    )
    assert "instagram" in con_redes.lower()
    assert "instagram" not in sin_redes.lower()


# ── Segmentación (R8-R11), con datos reales en DB ─────────────────────────

@pytest.fixture
async def db():
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        yield session


async def _make_org(db) -> tuple[Organization, User]:
    suffix = uuid.uuid4().hex[:8]
    org = Organization(
        name=f"Org Comms {suffix}", slug=f"org-comms-{suffix}", status="verificada",
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
        title=f"Campaña Comms {suffix}", slug=f"camp-comms-{suffix}", status="active",
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def _make_signature(
    db, campaign: Campaign, org: Organization, *,
    status: str = "confirmed", visibility: str = "publica", signer_type: str = "natural",
    country: str | None = None, archived: bool = False, notify_updates: bool = False,
    name: str = "Firmante Test",
) -> Signature:
    email = f"{uuid.uuid4().hex[:10]}@test.local"
    sig = Signature(
        campaign_id=campaign.id, org_id=org.id, name=name,
        email_encrypted=encrypt_pii(email), email_hash=compute_hmac(email),
        visibility=visibility, status=status, signer_type=signer_type, country=country,
        archived_at=datetime.now(timezone.utc) if archived else None,
        confirmation_token=uuid.uuid4().hex, ip_hmac=compute_hmac("127.0.0.1"),
    )
    db.add(sig)
    await db.flush()
    consent = Consent(
        signature_id=sig.id, campaign_id=campaign.id, org_id=org.id,
        text_snapshot="aviso", version="1", legal_basis="consentimiento_expreso",
        notify_updates=notify_updates,
    )
    db.add(consent)
    await db.commit()
    await db.refresh(sig)
    return sig


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


@pytest.mark.asyncio
async def test_anuncios_solo_cuenta_confirmadas_y_consentidas(db):
    """R11: clase anuncios = notify_updates=true AND confirmed AND no archivada."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        await _make_signature(db, camp, org, status="confirmed", notify_updates=True)  # cuenta
        await _make_signature(db, camp, org, status="confirmed", notify_updates=False)  # sin consentimiento
        await _make_signature(db, camp, org, status="pending_confirmation", notify_updates=True)  # pendiente
        await _make_signature(db, camp, org, status="confirmed", notify_updates=True, archived=True)  # archivada

        count = await count_recipients(db, camp.id, "general", AudienceFilter())
        assert count == 1

        recipients = await get_recipients(db, camp.id, "general", AudienceFilter())
        assert len(recipients) == 1
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_servicio_no_requiere_consentimiento_pero_exige_confirmada(db):
    """R11: clase servicio (invitation/closing) cuenta confirmadas sin exigir
    notify_updates — pero en Fase 1 sigue excluyendo pending_confirmation
    (ninguno de los 3 tipos es el 'recordatorio de confirmación')."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        await _make_signature(db, camp, org, status="confirmed", notify_updates=False)  # cuenta igual
        await _make_signature(db, camp, org, status="pending_confirmation", notify_updates=False)  # no cuenta

        for tipo in ("invitation", "closing"):
            count = await count_recipients(db, camp.id, tipo, AudienceFilter())
            assert count == 1, f"tipo={tipo}"
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_secretas_nunca_cuentan(db):
    """R11: las firmas secretas nunca se exponen — ninguna clase las incluye."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        await _make_signature(db, camp, org, status="confirmed", visibility="secreta", notify_updates=True)
        assert await count_recipients(db, camp.id, "general", AudienceFilter()) == 0
        assert await count_recipients(db, camp.id, "invitation", AudienceFilter()) == 0

        # Aunque el audience filter intente pedir "secreta" explícitamente, se ignora.
        audience = AudienceFilter(visibilities=["secreta"])
        assert await count_recipients(db, camp.id, "invitation", audience) == 0
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_filtros_tipo_ubicacion_visibilidad(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        await _make_signature(db, camp, org, signer_type="natural", country=None, visibility="publica")
        await _make_signature(db, camp, org, signer_type="org", country=None, visibility="publica")
        await _make_signature(db, camp, org, signer_type="natural", country="Colombia", visibility="anonima")

        assert await count_recipients(db, camp.id, "invitation", AudienceFilter()) == 3

        solo_natural = AudienceFilter(signer_types=["natural"])
        assert await count_recipients(db, camp.id, "invitation", solo_natural) == 2

        solo_ecuador = AudienceFilter(locations=["nacional"])
        assert await count_recipients(db, camp.id, "invitation", solo_ecuador) == 2

        solo_internacional = AudienceFilter(locations=["internacional"])
        assert await count_recipients(db, camp.id, "invitation", solo_internacional) == 1

        solo_publica = AudienceFilter(visibilities=["publica"])
        assert await count_recipients(db, camp.id, "invitation", solo_publica) == 2
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_get_recipients_decifra_email_y_nombre(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        await _make_signature(db, camp, org, name="Ana Pérez")
        recipients = await get_recipients(db, camp.id, "invitation", AudienceFilter())
        assert len(recipients) == 1
        email, name = recipients[0]
        assert "@" in email
        assert name == "Ana Pérez"
    finally:
        await _cleanup(db, org, user, camp)
