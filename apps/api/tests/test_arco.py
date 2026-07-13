"""Tests de derechos-arco (R13): anti-enumeración, tokens, cada derecho, multi-campaña, auditoría, rate limiting."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt
from sqlalchemy import delete, select, text

from app.config import settings
from app.crypto import compute_hmac, decrypt_pii, encrypt_pii
from app.database import AsyncSessionLocal
from app.models.arco_request import ArcoRequest
from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.organization import Organization
from app.models.signature import Signature
from app.models.user import User
from app.schemas.arco import ArcoCampaignProfileRequest, ArcoOpposeRequest, ArcoPersonalDataRequest
from app.services import arco_service
from app.services.campaign_service import CampaignService


@pytest.fixture
async def db():
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        yield session


async def _make_org(db) -> tuple[Organization, User]:
    suffix = uuid.uuid4().hex[:8]
    org = Organization(
        name=f"Org Arco {suffix}",
        slug=f"org-arco-{suffix}",
        status="verificada",
        contact_email=f"contacto-{suffix}@test.local",
    )
    db.add(org)
    await db.flush()
    admin_user = User(org_id=org.id, email=f"admin-{suffix}@test.local", password_hash="x", role="admin")
    db.add(admin_user)
    await db.commit()
    return org, admin_user


async def _make_campaign(db, org: Organization, user: User, *, status: str = "active") -> Campaign:
    suffix = uuid.uuid4().hex[:8]
    campaign = Campaign(
        org_id=org.id, created_by=user.id,
        title=f"Campaña Arco {suffix}", slug=f"camp-arco-{suffix}", status=status,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def _make_signature(
    db, campaign: Campaign, org: Organization, *,
    email: str, cedula: str = "1710034065",
    visibility: str = "publica", status: str = "confirmed",
) -> Signature:
    sig = Signature(
        campaign_id=campaign.id,
        org_id=org.id,
        name="Firmante Arco",
        email_encrypted=encrypt_pii(email),
        email_hash=compute_hmac(email),
        cedula_encrypted=encrypt_pii(cedula),
        cedula_hash=compute_hmac(cedula),
        provincia="Pichincha",
        country=None,
        visibility=visibility,
        status=status,
        confirmed_at=datetime.now(timezone.utc) if status == "confirmed" else None,
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
        subscribe_newsletter=False,
    )
    db.add(consent)
    await db.commit()
    await db.refresh(sig)
    return sig


def _session_for(sigs: list[Signature], origin_campaign_id: str | None = None, auto_confirmed_ids: list[str] | None = None) -> dict:
    return {
        "typ": "arco_portal",
        "signature_ids": [str(s.id) for s in sigs],
        "origin_campaign_id": origin_campaign_id or str(sigs[0].campaign_id),
        "auto_confirmed_ids": auto_confirmed_ids or [],
    }


async def _cleanup(db, orgs, users, campaigns) -> None:
    campaign_ids = [c.id for c in campaigns]
    sig_ids_result = await db.execute(select(Signature.id).where(Signature.campaign_id.in_(campaign_ids)))
    sig_ids = [row[0] for row in sig_ids_result.all()]
    await db.execute(delete(Consent).where(Consent.signature_id.in_(sig_ids)))
    await db.execute(delete(Signature).where(Signature.campaign_id.in_(campaign_ids)))
    await db.execute(delete(ArcoRequest).where(ArcoRequest.campaign_id.in_(campaign_ids)))
    await db.execute(delete(Campaign).where(Campaign.id.in_(campaign_ids)))
    for user in users:
        await db.execute(delete(User).where(User.id == user.id))
    for org in orgs:
        await db.execute(delete(Organization).where(Organization.id == org.id))
    await db.commit()


# ─── Anti-enumeración (R2, R12, T15) ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_request_access_sin_coincidencia_no_audita(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        await arco_service.request_access(db, "no-existe@test.local", "1710034065")
        result = await db.execute(select(ArcoRequest).where(ArcoRequest.campaign_id == campaign.id))
        assert result.scalars().all() == []
    finally:
        await _cleanup(db, [org], [user], [campaign])


@pytest.mark.asyncio
async def test_request_access_firma_anonimizada_no_coincide(db):
    """R12: tras anonimizar, email_hash/cedula_hash cambian — deja de aparecer en la búsqueda."""
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email)
        from app.services.retention_service import anonymize_signature
        anonymize_signature(sig, datetime.now(timezone.utc))
        await db.commit()

        await arco_service.request_access(db, email, "1710034065")

        result = await db.execute(select(ArcoRequest).where(ArcoRequest.campaign_id == campaign.id))
        assert result.scalars().all() == []
    finally:
        await _cleanup(db, [org], [user], [campaign])


# ─── Multi-campaña: ancla de token + re-consulta (R1b, T16) ──────────────────

@pytest.mark.asyncio
async def test_request_access_ancla_token_en_una_fila_y_audita_todas(db):
    org, user = await _make_org(db)
    campaign_a = await _make_campaign(db, org, user)
    campaign_b = await _make_campaign(db, org, user)
    try:
        email = f"multi-{uuid.uuid4().hex[:8]}@test.local"
        sig_a = await _make_signature(db, campaign_a, org, email=email)
        sig_b = await _make_signature(db, campaign_b, org, email=email)

        await arco_service.request_access(db, email, "1710034065", origin_campaign_id=str(campaign_b.id))

        await db.refresh(sig_a)
        await db.refresh(sig_b)
        # el token se ancla SOLO en la campaña de origen (constraint UNIQUE)
        assert sig_a.arco_verification_token is None
        assert sig_b.arco_verification_token is not None

        # pero la auditoría cubre ambas campañas
        result = await db.execute(select(ArcoRequest).where(ArcoRequest.campaign_id.in_([campaign_a.id, campaign_b.id])))
        rows = result.scalars().all()
        assert len(rows) == 2
        assert all(r.result == "completed" for r in rows)
    finally:
        await _cleanup(db, [org], [user], [campaign_a, campaign_b])


@pytest.mark.asyncio
async def test_verify_token_reconsulta_conjunto_vigente(db):
    org, user = await _make_org(db)
    campaign_a = await _make_campaign(db, org, user)
    campaign_b = await _make_campaign(db, org, user)
    try:
        email = f"multi-{uuid.uuid4().hex[:8]}@test.local"
        sig_a = await _make_signature(db, campaign_a, org, email=email)
        sig_b = await _make_signature(db, campaign_b, org, email=email)

        raw_token = uuid.uuid4().hex
        sig_a.arco_verification_token = compute_hmac(raw_token)
        sig_a.arco_verification_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.commit()

        session_result = await arco_service.verify_token(db, raw_token)
        assert session_result is not None
        portal_token, expires_at = session_result

        payload = jwt.decode(portal_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        ids = set(payload["signature_ids"])
        assert ids == {str(sig_a.id), str(sig_b.id)}
        assert payload["origin_campaign_id"] == str(campaign_a.id)

        await db.refresh(sig_a)
        assert sig_a.arco_verification_token is None  # un solo uso
    finally:
        await _cleanup(db, [org], [user], [campaign_a, campaign_b])


@pytest.mark.asyncio
async def test_verify_token_expirado(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email)
        raw_token = uuid.uuid4().hex
        sig.arco_verification_token = compute_hmac(raw_token)
        sig.arco_verification_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        await db.commit()

        session_result = await arco_service.verify_token(db, raw_token)
        assert session_result is None

        await db.refresh(sig)
        assert sig.arco_verification_token is None  # se limpia igual, aunque haya expirado
    finally:
        await _cleanup(db, [org], [user], [campaign])


def test_decode_portal_session_rechaza_jwt_de_otro_tipo():
    payload = {
        "typ": "otro_scope",
        "signature_ids": [str(uuid.uuid4())],
        "origin_campaign_id": str(uuid.uuid4()),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    with pytest.raises(ValueError):
        arco_service.decode_portal_session(token)


def test_decode_portal_session_rechaza_jwt_expirado():
    payload = {
        "typ": "arco_portal",
        "signature_ids": [str(uuid.uuid4())],
        "origin_campaign_id": str(uuid.uuid4()),
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    with pytest.raises(ValueError):
        arco_service.decode_portal_session(token)


# ─── Auto-confirmación al verificar (R1c) ────────────────────────────────────

@pytest.mark.asyncio
async def test_verify_token_auto_confirma_si_campana_firmable(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user, status="active")
    try:
        email = f"pendiente-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email, status="pending_confirmation")
        raw_token = uuid.uuid4().hex
        sig.arco_verification_token = compute_hmac(raw_token)
        sig.arco_verification_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.commit()

        session_result = await arco_service.verify_token(db, raw_token)
        assert session_result is not None
        portal_token, _ = session_result
        payload = jwt.decode(portal_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        assert str(sig.id) in payload["auto_confirmed_ids"]

        await db.refresh(sig)
        assert sig.status == "confirmed"
        assert sig.confirmed_at is not None
    finally:
        await _cleanup(db, [org], [user], [campaign])


@pytest.mark.asyncio
async def test_verify_token_no_auto_confirma_si_campana_cerrada(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user, status="closed")
    try:
        email = f"pendiente-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email, status="pending_confirmation")
        raw_token = uuid.uuid4().hex
        sig.arco_verification_token = compute_hmac(raw_token)
        sig.arco_verification_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.commit()

        session_result = await arco_service.verify_token(db, raw_token)
        assert session_result is not None
        portal_token, _ = session_result
        payload = jwt.decode(portal_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        assert payload["auto_confirmed_ids"] == []

        await db.refresh(sig)
        assert sig.status == "pending_confirmation"
    finally:
        await _cleanup(db, [org], [user], [campaign])


# ─── Confirmación manual (R14) ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_confirm_pending_manual_si_campana_firmable(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user, status="active")
    try:
        email = f"pendiente-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email, status="pending_confirmation")
        session = _session_for([sig])

        await arco_service.confirm_pending(db, session, sig.id)

        await db.refresh(sig)
        assert sig.status == "confirmed"
    finally:
        await _cleanup(db, [org], [user], [campaign])


@pytest.mark.asyncio
async def test_confirm_pending_rechaza_si_campana_cerrada(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user, status="closed")
    try:
        email = f"pendiente-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email, status="pending_confirmation")
        session = _session_for([sig])

        with pytest.raises(ValueError):
            await arco_service.confirm_pending(db, session, sig.id)
    finally:
        await _cleanup(db, [org], [user], [campaign])


@pytest.mark.asyncio
async def test_confirm_pending_rechaza_si_ya_confirmada(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user, status="active")
    try:
        email = f"confirmada-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email, status="confirmed")
        session = _session_for([sig])

        with pytest.raises(ValueError):
            await arco_service.confirm_pending(db, session, sig.id)
    finally:
        await _cleanup(db, [org], [user], [campaign])


# ─── Acceso (R5) ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_subject_data_agrupa_campanias(db):
    org, user = await _make_org(db)
    campaign_a = await _make_campaign(db, org, user)
    campaign_b = await _make_campaign(db, org, user)
    try:
        email = f"multi-{uuid.uuid4().hex[:8]}@test.local"
        sig_a = await _make_signature(db, campaign_a, org, email=email)
        sig_b = await _make_signature(db, campaign_b, org, email=email)
        session = _session_for([sig_a, sig_b], origin_campaign_id=str(campaign_b.id))

        data = await arco_service.get_subject_data(db, session)

        assert len(data["campaigns"]) == 2
        assert data["cedula_masked"] == "17XXXXX065"
        # la campaña de origen aparece primero
        assert data["campaigns"][0]["is_origin"] is True
        assert data["campaigns"][0]["campaign_id"] == campaign_b.id
    finally:
        await _cleanup(db, [org], [user], [campaign_a, campaign_b])


@pytest.mark.asyncio
async def test_get_session_signature_fuera_de_alcance(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email)
        session = {"typ": "arco_portal", "signature_ids": [str(uuid.uuid4())], "origin_campaign_id": str(campaign.id), "auto_confirmed_ids": []}
        with pytest.raises(ValueError):
            await arco_service._get_session_signature(db, session, sig.id)
    finally:
        await _cleanup(db, [org], [user], [campaign])


# ─── Rectificación — datos personales, compartidos (R6a) ────────────────────

@pytest.mark.asyncio
async def test_rectify_personal_data_aplica_a_todas_las_campanias(db):
    org, user = await _make_org(db)
    campaign_a = await _make_campaign(db, org, user)
    campaign_b = await _make_campaign(db, org, user)
    try:
        email = f"multi-{uuid.uuid4().hex[:8]}@test.local"
        sig_a = await _make_signature(db, campaign_a, org, email=email, visibility="publica")
        sig_b = await _make_signature(db, campaign_b, org, email=email, visibility="publica")
        session = _session_for([sig_a, sig_b])

        await arco_service.rectify_personal_data(db, session, ArcoPersonalDataRequest(name="Nuevo Nombre"))

        await db.refresh(sig_a)
        await db.refresh(sig_b)
        assert sig_a.name == "Nuevo Nombre"
        assert sig_b.name == "Nuevo Nombre"

        # trazabilidad sin PII: qué cambió, no el valor
        result = await db.execute(
            select(ArcoRequest).where(ArcoRequest.campaign_id.in_([campaign_a.id, campaign_b.id]), ArcoRequest.right_type == "rectificacion")
        )
        rows = result.scalars().all()
        assert len(rows) == 2
        for r in rows:
            assert set(r.detail["fields_changed"]) == {"name"}
            assert "Nuevo Nombre" not in str(r.detail)
    finally:
        await _cleanup(db, [org], [user], [campaign_a, campaign_b])


@pytest.mark.asyncio
async def test_rectify_personal_data_respeta_invariante_visibilidad(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        email = f"secreta-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email, visibility="secreta")
        session = _session_for([sig])

        await arco_service.rectify_personal_data(db, session, ArcoPersonalDataRequest(name="Nombre Nuevo"))

        await db.refresh(sig)
        assert sig.name is None  # invariante: sin nombre fuera de visibilidad pública
    finally:
        await _cleanup(db, [org], [user], [campaign])


# ─── Visibilidad — por campaña (R6b) ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_set_visibility_por_campana_no_afecta_otras(db):
    org, user = await _make_org(db)
    campaign_a = await _make_campaign(db, org, user)
    campaign_b = await _make_campaign(db, org, user)
    try:
        email = f"multi-{uuid.uuid4().hex[:8]}@test.local"
        sig_a = await _make_signature(db, campaign_a, org, email=email, visibility="publica")
        sig_b = await _make_signature(db, campaign_b, org, email=email, visibility="publica")
        session = _session_for([sig_a, sig_b])

        await arco_service.set_visibility(db, session, sig_a.id, "secreta")

        await db.refresh(sig_a)
        await db.refresh(sig_b)
        assert sig_a.visibility == "secreta"
        assert sig_a.name is None
        assert sig_b.visibility == "publica"
        assert sig_b.name is not None
    finally:
        await _cleanup(db, [org], [user], [campaign_a, campaign_b])


@pytest.mark.asyncio
async def test_set_visibility_invalida(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email)
        session = _session_for([sig])
        with pytest.raises(ValueError):
            await arco_service.set_visibility(db, session, sig.id, "no-existe")
    finally:
        await _cleanup(db, [org], [user], [campaign])


# ─── Oposición — por campaña (R8) ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_oppose_por_campana(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email)
        session = _session_for([sig])

        await arco_service.oppose(db, session, sig.id, ArcoOpposeRequest(signature_id=sig.id, notify_updates=False, subscribe_newsletter=True))

        consent_result = await db.execute(select(Consent).where(Consent.signature_id == sig.id))
        consent = consent_result.scalar_one()
        assert consent.notify_updates is False
        assert consent.subscribe_newsletter is True
    finally:
        await _cleanup(db, [org], [user], [campaign])


# ─── Portabilidad — unificada (R9) ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_export_data_unificado_json_y_csv(db):
    org, user = await _make_org(db)
    campaign_a = await _make_campaign(db, org, user)
    campaign_b = await _make_campaign(db, org, user)
    try:
        email = f"multi-{uuid.uuid4().hex[:8]}@test.local"
        sig_a = await _make_signature(db, campaign_a, org, email=email)
        sig_b = await _make_signature(db, campaign_b, org, email=email)
        session = _session_for([sig_a, sig_b])

        content_json, media_json, _ = await arco_service.export_data(db, session, "json")
        assert media_json == "application/json"
        import json
        parsed = json.loads(content_json)
        assert len(parsed) == 2
        assert {row["email"] for row in parsed} == {email}

        content_csv, media_csv, _ = await arco_service.export_data(db, session, "csv")
        assert media_csv.startswith("text/csv")
        assert content_csv.count(email) == 2
    finally:
        await _cleanup(db, [org], [user], [campaign_a, campaign_b])


# ─── Supresión — por campaña (R7) ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_subject_por_campana_no_afecta_otras(db):
    org, user = await _make_org(db)
    campaign_a = await _make_campaign(db, org, user)
    campaign_b = await _make_campaign(db, org, user)
    try:
        email = f"multi-{uuid.uuid4().hex[:8]}@test.local"
        sig_a = await _make_signature(db, campaign_a, org, email=email)
        sig_b = await _make_signature(db, campaign_b, org, email=email)
        session = _session_for([sig_a, sig_b])

        count_before = await CampaignService.list_with_counts(db, None)
        confirmed_before_a = next(c["confirmed_signatures"] for c in count_before if c["id"] == str(campaign_a.id))

        await arco_service.delete_subject(db, session, sig_a.id)

        await db.refresh(sig_a)
        await db.refresh(sig_b)
        assert sig_a.anonymized_at is not None
        assert sig_a.status == "confirmed"  # el apoyo sigue contando (R7)
        assert sig_b.anonymized_at is None  # otra campaña no se ve afectada

        count_after = await CampaignService.list_with_counts(db, None)
        confirmed_after_a = next(c["confirmed_signatures"] for c in count_after if c["id"] == str(campaign_a.id))
        assert confirmed_after_a == confirmed_before_a

        result = await db.execute(
            select(ArcoRequest).where(ArcoRequest.campaign_id == campaign_a.id, ArcoRequest.right_type == "supresion")
        )
        arco = result.scalar_one()
        assert arco.result == "completed"
        assert arco.detail["trigger"] == "arco_self_service"
    finally:
        await _cleanup(db, [org], [user], [campaign_a, campaign_b])


# ─── Auditoría sin PII (R10) ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_auditoria_nunca_contiene_email_en_claro(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email)
        session = _session_for([sig])

        await arco_service.get_subject_data(db, session)
        await arco_service.oppose(db, session, sig.id, ArcoOpposeRequest(signature_id=sig.id, notify_updates=False))

        result = await db.execute(select(ArcoRequest).where(ArcoRequest.campaign_id == campaign.id))
        requests = result.scalars().all()
        assert len(requests) >= 2
        for r in requests:
            assert email not in str(r.email_hash)
            assert email not in str(r.detail)
    finally:
        await _cleanup(db, [org], [user], [campaign])


# ─── Rate limiting (R4, T18) ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_request_access_rate_limit_3_por_hora(db, client):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        # IP aleatoria por corrida: evita colisión con contadores de ejecuciones previas
        # de este mismo test sin tocar las claves de rate-limit de tráfico real en curso.
        headers = {"X-Real-IP": f"10.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"}
        payload = {"email": "quien-sea@test.local", "cedula": "1710034065", "cf_turnstile_token": "x"}

        statuses = []
        for _ in range(4):
            resp = await client.post("/v1/arco/request-access", json=payload, headers=headers)
            statuses.append(resp.status_code)

        assert statuses[:3] == [200, 200, 200]
        assert statuses[3] == 429
    finally:
        await _cleanup(db, [org], [user], [campaign])


# ─── Rectificación — email/cédula/celular (nuevo, sesión 30) ─────────────────

@pytest.mark.asyncio
async def test_rectify_personal_data_celular_opcional(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email)
        session = _session_for([sig])

        await arco_service.rectify_personal_data(db, session, ArcoPersonalDataRequest(celular="0991234567"))

        await db.refresh(sig)
        assert sig.celular_encrypted is not None
        assert decrypt_pii(sig.celular_encrypted, ref=str(sig.id)) == "0991234567"

        data = await arco_service.get_subject_data(db, session)
        assert data["celular_masked"] == "XXXXXX4567"
    finally:
        await _cleanup(db, [org], [user], [campaign])


@pytest.mark.asyncio
async def test_rectify_personal_data_cambia_email_sin_choque(db):
    org, user = await _make_org(db)
    campaign_a = await _make_campaign(db, org, user)
    campaign_b = await _make_campaign(db, org, user)
    try:
        old_email = f"viejo-{uuid.uuid4().hex[:8]}@test.local"
        new_email = f"nuevo-{uuid.uuid4().hex[:8]}@test.local"
        sig_a = await _make_signature(db, campaign_a, org, email=old_email)
        sig_b = await _make_signature(db, campaign_b, org, email=old_email)
        session = _session_for([sig_a, sig_b])

        result = await arco_service.rectify_personal_data(db, session, ArcoPersonalDataRequest(email=new_email))

        assert result["conflicts"] == []
        await db.refresh(sig_a)
        await db.refresh(sig_b)
        assert sig_a.email_hash == compute_hmac(new_email)
        assert sig_b.email_hash == compute_hmac(new_email)
        assert decrypt_pii(sig_a.email_encrypted, ref=str(sig_a.id)) == new_email
    finally:
        await _cleanup(db, [org], [user], [campaign_a, campaign_b])


@pytest.mark.asyncio
async def test_rectify_personal_data_choque_de_email_aplica_donde_se_puede(db):
    org, user = await _make_org(db)
    campaign_a = await _make_campaign(db, org, user)
    campaign_b = await _make_campaign(db, org, user)
    try:
        old_email = f"viejo-{uuid.uuid4().hex[:8]}@test.local"
        new_email = f"ocupado-{uuid.uuid4().hex[:8]}@test.local"
        sig_a = await _make_signature(db, campaign_a, org, email=old_email)
        sig_b = await _make_signature(db, campaign_b, org, email=old_email)
        # otra firma YA usa el correo nuevo, pero solo en la campaña B
        await _make_signature(db, campaign_b, org, email=new_email, cedula="0102030400")
        session = _session_for([sig_a, sig_b])

        result = await arco_service.rectify_personal_data(db, session, ArcoPersonalDataRequest(email=new_email))

        assert len(result["conflicts"]) == 1
        assert result["conflicts"][0]["campaign_id"] == campaign_b.id
        assert result["conflicts"][0]["field"] == "email"

        await db.refresh(sig_a)
        await db.refresh(sig_b)
        assert sig_a.email_hash == compute_hmac(new_email)  # se aplicó en A
        assert sig_b.email_hash == compute_hmac(old_email)  # quedó igual en B (choque)
    finally:
        await _cleanup(db, [org], [user], [campaign_a, campaign_b])


@pytest.mark.asyncio
async def test_rectify_personal_data_email_reenvia_confirmacion_si_pendiente(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user, status="active")
    try:
        old_email = f"viejo-{uuid.uuid4().hex[:8]}@test.local"
        new_email = f"nuevo-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=old_email, status="pending_confirmation")
        old_token = sig.confirmation_token
        session = _session_for([sig])

        await arco_service.rectify_personal_data(db, session, ArcoPersonalDataRequest(email=new_email))

        await db.refresh(sig)
        assert sig.status == "pending_confirmation"
        assert sig.confirmation_token != old_token
        assert sig.confirmation_token is not None
    finally:
        await _cleanup(db, [org], [user], [campaign])


@pytest.mark.asyncio
async def test_rectify_personal_data_cedula_invalida(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email)
        session = _session_for([sig])

        with pytest.raises(ValueError):
            await arco_service.rectify_personal_data(db, session, ArcoPersonalDataRequest(cedula="1234567890"))
    finally:
        await _cleanup(db, [org], [user], [campaign])


@pytest.mark.asyncio
async def test_rectify_personal_data_choque_de_cedula(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email, cedula="1710034065")
        # otra firma en la MISMA campaña ya usa la cédula nueva
        await _make_signature(db, campaign, org, email=f"otro-{uuid.uuid4().hex[:8]}@test.local", cedula="0102030400")
        session = _session_for([sig])

        result = await arco_service.rectify_personal_data(db, session, ArcoPersonalDataRequest(cedula="0102030400"))

        assert len(result["conflicts"]) == 1
        assert result["conflicts"][0]["field"] == "cedula"
        await db.refresh(sig)
        assert sig.cedula_hash == compute_hmac("1710034065")  # sin cambios
    finally:
        await _cleanup(db, [org], [user], [campaign])


# ─── Congelamiento por cierre de campaña (nuevo, sesión 30) ──────────────────

@pytest.mark.asyncio
async def test_rectify_personal_data_congela_nombre_email_cedula_si_campana_cerro(db):
    org, user = await _make_org(db)
    campaign_open = await _make_campaign(db, org, user, status="active")
    campaign_closed = await _make_campaign(db, org, user, status="closed")
    try:
        email = f"multi-{uuid.uuid4().hex[:8]}@test.local"
        new_email = f"nuevo-{uuid.uuid4().hex[:8]}@test.local"
        sig_open = await _make_signature(db, campaign_open, org, email=email)
        sig_closed = await _make_signature(db, campaign_closed, org, email=email)
        session = _session_for([sig_open, sig_closed])

        result = await arco_service.rectify_personal_data(
            db, session, ArcoPersonalDataRequest(name="Nombre Nuevo", email=new_email)
        )

        reasons = {(c["campaign_id"], c["field"]): c["reason"] for c in result["conflicts"]}
        assert reasons[(campaign_closed.id, "name")] == "campana_cerrada"
        assert reasons[(campaign_closed.id, "email")] == "campana_cerrada"

        await db.refresh(sig_open)
        await db.refresh(sig_closed)
        assert sig_open.name == "Nombre Nuevo"
        assert sig_open.email_hash == compute_hmac(new_email)
        assert sig_closed.name != "Nombre Nuevo"  # congelado
        assert sig_closed.email_hash == compute_hmac(email)  # congelado
    finally:
        await _cleanup(db, [org], [user], [campaign_open, campaign_closed])


@pytest.mark.asyncio
async def test_rectify_personal_data_celular_editable_aunque_campana_cerro(db):
    org, user = await _make_org(db)
    campaign_closed = await _make_campaign(db, org, user, status="closed")
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign_closed, org, email=email)
        session = _session_for([sig])

        result = await arco_service.rectify_personal_data(db, session, ArcoPersonalDataRequest(celular="0991234567"))

        assert result["conflicts"] == []
        await db.refresh(sig)
        assert decrypt_pii(sig.celular_encrypted, ref=str(sig.id)) == "0991234567"
    finally:
        await _cleanup(db, [org], [user], [campaign_closed])


# ─── Perfil por campaña: tipo de firmante/ubicación/provincia-país (nuevo) ───

@pytest.mark.asyncio
async def test_update_campaign_profile_provincia_editable_siempre(db):
    org, user = await _make_org(db)
    campaign_closed = await _make_campaign(db, org, user, status="closed")
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign_closed, org, email=email, status="confirmed")
        session = _session_for([sig])

        await arco_service.update_campaign_profile(db, session, sig.id, ArcoCampaignProfileRequest(signature_id=sig.id, provincia="Loja"))

        await db.refresh(sig)
        assert sig.provincia == "Loja"
    finally:
        await _cleanup(db, [org], [user], [campaign_closed])


@pytest.mark.asyncio
async def test_update_campaign_profile_estructura_editable_si_pendiente_y_activa(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user, status="active")
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email, status="pending_confirmation")
        session = _session_for([sig])

        await arco_service.update_campaign_profile(
            db, session, sig.id, ArcoCampaignProfileRequest(signature_id=sig.id, signer_type="org", org_name="Fundación Test", location_mode="internacional", country="Colombia")
        )

        await db.refresh(sig)
        assert sig.signer_type == "org"
        assert sig.org_name == "Fundación Test"
        assert sig.provincia is None  # se limpió al pasar a internacional
        assert sig.country == "Colombia"
    finally:
        await _cleanup(db, [org], [user], [campaign])


@pytest.mark.asyncio
async def test_update_campaign_profile_estructura_bloqueada_si_confirmada(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user, status="active")
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email, status="confirmed")
        session = _session_for([sig])

        with pytest.raises(ValueError):
            await arco_service.update_campaign_profile(db, session, sig.id, ArcoCampaignProfileRequest(signature_id=sig.id, signer_type="org"))
    finally:
        await _cleanup(db, [org], [user], [campaign])


@pytest.mark.asyncio
async def test_update_campaign_profile_estructura_bloqueada_si_campana_cerrada(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user, status="closed")
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email, status="pending_confirmation")
        session = _session_for([sig])

        with pytest.raises(ValueError):
            await arco_service.update_campaign_profile(db, session, sig.id, ArcoCampaignProfileRequest(signature_id=sig.id, location_mode="internacional"))
    finally:
        await _cleanup(db, [org], [user], [campaign])


@pytest.mark.asyncio
async def test_get_subject_data_incluye_perfil_por_campana(db):
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user, status="active")
    try:
        email = f"firmante-{uuid.uuid4().hex[:8]}@test.local"
        sig = await _make_signature(db, campaign, org, email=email, status="pending_confirmation")
        session = _session_for([sig])

        data = await arco_service.get_subject_data(db, session)

        campaign_data = data["campaigns"][0]
        assert campaign_data["signer_type"] == "natural"
        assert campaign_data["location_mode"] == "nacional"
        assert campaign_data["provincia"] == "Pichincha"
        assert campaign_data["profile_editable"] is True
    finally:
        await _cleanup(db, [org], [user], [campaign])
