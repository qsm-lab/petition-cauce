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
    AudienceFilter, CtaButton, InvalidCommsType, MergeContext, RecipientData, build_comms_email_html,
    build_merge_context, build_segment_filters, count_recipients, get_recipients, render_merge_tags,
    sanitize_comms_html, unsubscribe_url_for,
)
from app.services.signature_service import unsubscribe_by_token, unsubscribe_token


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


def test_img_style_se_fuerza_a_valor_seguro_ignorando_el_del_autor():
    """El estándar de ancho de email (600px) exige que las imágenes sean
    responsivas — el style se reinyecta con un valor fijo, sin importar lo
    que traiga el HTML original (ni siquiera si intenta CSS injection)."""
    from app.config import settings
    origin = (settings.api_public_url or "").rstrip("/")
    html = f'<img src="{origin}/media/x.png" style="width:2000px;background:url(evil.com)">'
    out = sanitize_comms_html(html)
    assert 'style="max-width:100%;height:auto;display:block;border-radius:8px;margin:8px 0;"' in out
    assert "2000px" not in out
    assert "evil.com" not in out


def test_img_sin_style_previo_tambien_recibe_el_valor_seguro():
    from app.config import settings
    origin = (settings.api_public_url or "").rstrip("/")
    html = f'<img src="{origin}/media/x.png" alt="x">'
    out = sanitize_comms_html(html)
    assert 'style="max-width:100%' in out


def test_sanitiza_permite_alineacion_de_texto():
    out = sanitize_comms_html('<p style="text-align: center">centrado</p><h2 style="text-align:right">der</h2>')
    assert 'style="text-align:center;"' in out
    assert 'style="text-align:right;"' in out


def test_sanitiza_rechaza_css_arbitrario_en_style():
    """Solo text-align:left|center|right sobrevive — cualquier otro valor
    (incluido un intento de inyección) se descarta entero."""
    out = sanitize_comms_html('<p style="background:url(evil.com);text-align:center">x</p>')
    assert "evil.com" not in out
    assert "style=" not in out


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


# ── Merge tags <tag> (sin saludo fijo) ──────────────────────────────────────

def test_no_hay_saludo_fijo_en_el_template():
    html = build_comms_email_html(org_name="Acme", heading="T", body_html="<p>x</p>")
    assert "Hola" not in html


def test_render_merge_tags_sustituye_forma_escapada_del_editor_visual():
    """El editor visual (TipTap) serializa texto plano tipeado con entidades
    HTML — <nombre> tipeado como texto normal llega como &lt;nombre&gt;."""
    ctx = MergeContext(nombre="Ana", nombre_completo="Ana Pérez")
    out = render_merge_tags("<p>Hola &lt;nombre&gt;, tu nombre completo es &lt;nombre completo&gt;</p>", ctx)
    assert "Hola Ana," in out
    assert "Ana Pérez" in out
    assert "&lt;nombre&gt;" not in out


def test_render_merge_tags_sustituye_forma_literal():
    ctx = MergeContext(nombre="Ana")
    out = render_merge_tags("<p>Hola <nombre></p>", ctx)
    assert "Hola Ana" in out


def test_render_merge_tags_escapa_el_valor_sustituido():
    """El nombre de un firmante podría contener caracteres HTML — se escapa
    antes de insertarse para no poder inyectar markup en el email."""
    ctx = MergeContext(nombre='<script>alert(1)</script>')
    out = render_merge_tags("<p>Hola <nombre></p>", ctx)
    assert "<script>" not in out
    assert "&lt;script&gt;" in out


def test_render_merge_tags_tag_sin_valor_muestra_guion():
    ctx = MergeContext()
    out = render_merge_tags("<p>Cédula: <cedula></p>", ctx)
    assert "Cédula: —" in out


def test_build_merge_context_enmascara_cedula_email_telefono():
    """Mismo patrón que la descarga normal de firmas (admin_signature_service):
    2 primeros + 3 últimos de cédula, 3 primeros + dominio de email, últimos
    4 dígitos de teléfono."""
    from app.crypto import encrypt_pii
    r = RecipientData(
        signature_id=uuid.uuid4(), email="juanperez@ejemplo.com", name="Juan Pérez",
        cedula_encrypted=encrypt_pii("1712345601"), celular_encrypted=encrypt_pii("0991234321"),
        provincia="Pichincha", country=None, org_name=None, signer_type="natural",
    )
    ctx = build_merge_context(r)
    assert ctx.nombre == "Juan"
    assert ctx.nombre_completo == "Juan Pérez"
    assert ctx.cedula == "17XXXXX601"
    assert ctx.email == "juaXXXXXX@ejemplo.com"
    assert ctx.telefono == "XXXXXX4321"
    assert ctx.provincia == "Pichincha"


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


# ── Desuscripción (R20) ──────────────────────────────────────────────────────

def test_unsubscribe_token_es_determinista_por_firma():
    sig_id = uuid.uuid4()
    assert unsubscribe_token(sig_id) == unsubscribe_token(sig_id)
    assert unsubscribe_token(sig_id) != unsubscribe_token(uuid.uuid4())


def test_unsubscribe_url_incluye_id_y_token():
    sig_id = uuid.uuid4()
    url = unsubscribe_url_for(sig_id)
    assert str(sig_id) in url
    assert f"token={unsubscribe_token(sig_id)}" in url
    assert "/v1/public-campaign/signatures/" in url and "/unsubscribe" in url


def test_build_comms_email_html_incluye_link_desuscripcion_si_se_pasa():
    con_link = build_comms_email_html(
        org_name="Acme", heading="T", body_html="<p>x</p>", unsubscribe_url="https://x.test/unsub",
    )
    sin_link = build_comms_email_html(org_name="Acme", heading="T", body_html="<p>x</p>")
    assert "https://x.test/unsub" in con_link
    assert "Cancelar suscripción" in con_link
    assert "Cancelar suscripción" not in sin_link


@pytest.mark.asyncio
async def test_unsubscribe_by_token_token_correcto_desactiva_notify_updates(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        sig = await _make_signature(db, camp, org, notify_updates=True)
        token = unsubscribe_token(sig.id)
        ok = await unsubscribe_by_token(db, sig.id, token)
        assert ok is True

        result = await db.execute(text("SELECT notify_updates FROM consents WHERE signature_id = :sid"), {"sid": str(sig.id)})
        assert result.scalar() is False
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_unsubscribe_by_token_token_incorrecto_no_cambia_nada(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        sig = await _make_signature(db, camp, org, notify_updates=True)
        ok = await unsubscribe_by_token(db, sig.id, "token-inventado")
        assert ok is False

        result = await db.execute(text("SELECT notify_updates FROM consents WHERE signature_id = :sid"), {"sid": str(sig.id)})
        assert result.scalar() is True
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_unsubscribe_by_token_firma_inexistente(db):
    ok = await unsubscribe_by_token(db, uuid.uuid4(), "cualquier-token")
    assert ok is False
