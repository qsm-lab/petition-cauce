import logging
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.organization import Organization
from app.models.privacy_config import PrivacyConfig
from app.models.privacy_policy import PrivacyPolicy
from app.models.signature import Signature
from app.crypto import compute_hmac, encrypt_pii, verify_cedula
from app.schemas.signature import SignatureCreate
from app.services.email_service import send_confirmation_email

logger = logging.getLogger(__name__)

_TOKEN_TTL_HOURS = 24

# Caso especial de sesión 32, NO generalizable a otras campañas: el bug que
# guardaba name=NULL en firmas no públicas ya se corrigió en create_signature
# (commit b9bbeae, sesión 31). Para soberania-tlc-ecu-usa quedaron firmas
# name IS NULL previas al fix que no deben contar en el total público ni en
# el email de cierre (no se puede validar un firmante sin nombre). Siguen
# visibles y contadas en el dashboard admin — solo se excluyen acá.
_LEGACY_NULL_NAME_EXCLUSION_CAMPAIGN_ID = uuid.UUID("63867787-5498-401e-90f7-990f46b1e09e")

_DEFAULT_FORM_CONFIG = {
    "signer_types": ["natural"],
    "location_modes": ["nacional"],
    "required_fields": ["nombre", "email", "cedula", "location"],
    "visibility_options": ["publica", "anonima"],
}


def _get_form_config(campaign: Campaign) -> dict:
    meta = campaign.meta or {}
    cfg = meta.get("form_config", {})
    return {**_DEFAULT_FORM_CONFIG, **cfg}


def build_privacy_url(slug: str | None) -> str:
    """URL pública del aviso de privacidad de la campaña (página /aviso-de-privacidad)."""
    from app.config import settings

    app_url = (settings.next_public_app_url or "http://localhost:3002").rstrip("/")
    return f"{app_url}/aviso-de-privacidad?slug={slug}" if slug else f"{app_url}/aviso-de-privacidad"


async def create_signature(
    db: AsyncSession,
    campaign: Campaign,
    data: SignatureCreate,
    ip_hmac: str,
    is_test: bool = False,
) -> Signature:
    """Persiste Signature + Consent. Lanza ValueError con código en caso de error lógico."""

    form_config = _get_form_config(campaign)
    required = set(form_config.get("required_fields", _DEFAULT_FORM_CONFIG["required_fields"]))

    # Cédula: el algoritmo de verificación solo aplica para firmantes nacionales (Ecuador).
    # Para internacionales el campo es siempre opcional y acepta cualquier formato.
    if data.location_mode == "nacional":
        if "cedula" in required:
            if not data.cedula:
                raise ValueError("cedula_requerida")
            if not verify_cedula(data.cedula):
                raise ValueError("cedula_invalida")
        elif data.cedula:
            if not verify_cedula(data.cedula):
                raise ValueError("cedula_invalida")
    # location_mode == "internacional": cualquier identificación es aceptada sin validar formato

    email_normalized = data.email.strip().lower()
    email_hash = compute_hmac(email_normalized)
    cedula_hash = compute_hmac(data.cedula) if data.cedula else None
    org_name_hash = compute_hmac(data.org_name.strip()) if data.org_name else None

    token = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_TTL_HOURS)

    # Snapshot del aviso realmente mostrado: política asignada primero, legacy después.
    text_snapshot, aviso_version, legal_basis = "", "1", "consentimiento_expreso"
    if campaign.privacy_policy_id:
        # La política puede pertenecer a la org plataforma (Encargado) y no a la org
        # de la campaña — sin bypass, RLS la oculta y el snapshot cae al legacy vacío
        from sqlalchemy import text as sa_text
        await db.execute(sa_text("SELECT set_config('app.is_platform_admin', 'true', true)"))
        pp_result = await db.execute(
            select(PrivacyPolicy).where(PrivacyPolicy.id == campaign.privacy_policy_id)
        )
        pp = pp_result.scalar_one_or_none()
        if pp:
            text_snapshot, aviso_version, legal_basis = pp.aviso_firmante, str(pp.version), pp.base_legal
    if not text_snapshot:
        pc_result = await db.execute(
            select(PrivacyConfig).where(PrivacyConfig.campaign_id == campaign.id)
        )
        pc = pc_result.scalar_one_or_none()
        if pc:
            text_snapshot, aviso_version, legal_basis = pc.aviso_privacidad, str(pc.version), pc.base_legal

    sig = Signature(
        campaign_id=campaign.id,
        org_id=campaign.org_id,
        # El nombre se guarda siempre, sin importar la visibilidad elegida:
        # anónima promete "se suma... al documento de entrega" (StepForm.tsx),
        # lo cual requiere conservar el nombre. La minimización ocurre en la
        # exposición (feed público, export CSV enmascarado, dashboard según
        # rol), no en la captura.
        name=data.name.strip(),
        email_encrypted=encrypt_pii(email_normalized),
        email_hash=email_hash,
        cedula_encrypted=encrypt_pii(data.cedula) if data.cedula else None,
        cedula_hash=cedula_hash,
        provincia=data.provincia if data.location_mode == "nacional" else None,
        country=data.country if data.location_mode == "internacional" else None,
        signer_type=data.signer_type,
        org_name=data.org_name.strip() if data.org_name else None,
        org_name_hash=org_name_hash,
        visibility=data.visibility,
        status="pending_confirmation",
        confirmation_token=token,
        confirmation_token_expires_at=expires_at,
        ip_hmac=ip_hmac,
        is_test=is_test,
    )
    db.add(sig)

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise ValueError("ya_firmaste")

    consent = Consent(
        signature_id=sig.id,
        campaign_id=campaign.id,
        org_id=campaign.org_id,
        text_snapshot=text_snapshot,
        version=aviso_version,
        legal_basis=legal_basis,
        ip_hmac=ip_hmac,
        subscribe_newsletter=data.subscribe_newsletter,
    )
    db.add(consent)
    await db.flush()

    await db.commit()
    await db.refresh(sig)

    try:
        org_result = await db.execute(
            select(Organization).where(Organization.id == campaign.org_id)
        )
        org = org_result.scalar_one_or_none()
        await send_confirmation_email(
            to_email=email_normalized,
            token=sig.confirmation_token,
            campaign_title=campaign.petition_title or campaign.title,
            signer_name=data.name or "",
            org_name=org.name if org else "",
            org_logo_url=(org.logo_url or "") if org else "",
            visibility=data.visibility,
            privacy_url=build_privacy_url(campaign.slug),
            org_contact_email=(org.contact_email or "") if org else "",
        )
    except Exception:
        logger.warning("[email] failed to send confirmation for sig %s", sig.id)

    return sig


async def confirm_signature(db: AsyncSession, token: str) -> dict | None:
    """Confirma firma por token. Retorna {status, slug, count, goal} o None si el token no existe.

    Idempotente: el token se conserva tras confirmar para que un segundo clic
    (o el prefetch del cliente de correo) no termine en error.
    status: "confirmed" | "expired".
    """
    # Bypass RLS transaccional (mismo patrón que la lectura cross-org del
    # aviso de privacidad): tras confirmar, la fila queda en
    # status='confirmed' y ninguna política pública/anónima cubre
    # visibility='secreta' — ni siquiera para el propio firmante completando
    # su token. La autorización real aquí es "conoce el token", no RLS.
    from sqlalchemy import text as sa_text
    await db.execute(sa_text("SELECT set_config('app.is_platform_admin', 'true', true)"))

    result = await db.execute(
        select(Signature).where(Signature.confirmation_token == token)
    )
    sig = result.scalar_one_or_none()
    if not sig:
        return None

    campaign_result = await db.execute(
        select(Campaign).where(Campaign.id == sig.campaign_id)
    )
    campaign = campaign_result.scalar_one_or_none()
    slug = campaign.slug if campaign else None

    now = datetime.now(timezone.utc)

    newly_confirmed = False
    if sig.status == "pending_confirmation":
        if sig.confirmation_token_expires_at:
            exp = sig.confirmation_token_expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if now > exp:
                return {"status": "expired", "slug": slug, "count": 0, "goal": None}
        sig.status = "confirmed"
        sig.confirmed_at = now
        newly_confirmed = True
        await db.flush()

    count_result = await db.execute(
        select(func.count()).where(
            Signature.campaign_id == sig.campaign_id,
            Signature.status == "confirmed",
        )
    )
    count = count_result.scalar() or 0

    signer_name = sig.name or ""
    email_encrypted = sig.email_encrypted

    await db.commit()

    # Segundo email: agradecimiento + kit de difusión (solo en la primera confirmación,
    # no en clics repetidos del enlace). Nunca bloquea la redirección.
    if newly_confirmed and campaign:
        try:
            from app.crypto import decrypt_pii
            from app.services.email_service import send_thanks_share_email

            email = decrypt_pii(email_encrypted, ref=str(sig.id))
            org_result = await db.execute(
                select(Organization).where(Organization.id == campaign.org_id)
            )
            org = org_result.scalar_one_or_none()
            meta = campaign.meta or {}
            from app.config import settings

            app_url = (settings.next_public_app_url or "http://localhost:3002").rstrip("/")
            await send_thanks_share_email(
                to_email=email,
                campaign_title=campaign.petition_title or campaign.title,
                campaign_url=f"{app_url}/c/{campaign.slug}",
                signer_name=signer_name,
                org_name=org.name if org else "",
                org_logo_url=(org.logo_url or "") if org else "",
                share_text=(meta.get("share_text") or ""),
                qr_code_data=(campaign.qr_code_data or "") if meta.get("show_qr") else "",
            )
        except Exception:
            logger.warning("[email] failed to send thanks email for sig %s", sig.id)

    return {
        "status": "confirmed",
        "slug": slug,
        "count": count,
        "goal": campaign.goal_count if campaign else None,
        "name": signer_name,
        "newly_confirmed": newly_confirmed,
    }


async def get_recent_signatures(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    limit: int = 10,
) -> list[dict]:
    result = await db.execute(
        select(Signature)
        .where(
            Signature.campaign_id == campaign_id,
            Signature.status == "confirmed",
            Signature.visibility == "publica",
        )
        .order_by(Signature.confirmed_at.desc())
        .limit(limit)
    )
    sigs = result.scalars().all()

    now = datetime.now(timezone.utc)
    items = []
    for sig in sigs:
        if sig.confirmed_at:
            ts = sig.confirmed_at
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            seconds = int((now - ts).total_seconds())
            if seconds < 60:
                time_ago = "hace un momento"
            elif seconds < 3600:
                time_ago = f"hace {seconds // 60} min"
            elif seconds < 86400:
                time_ago = f"hace {seconds // 3600} h"
            else:
                time_ago = f"hace {seconds // 86400} d"
        else:
            time_ago = ""

        items.append({
            "name_display": sig.name or "Anónimo",
            "provincia": sig.provincia or sig.country or "",
            "time_ago": time_ago,
            "is_anon": sig.name is None,
        })
    return items


async def get_signature_count(db: AsyncSession, campaign_id: uuid.UUID) -> int:
    filters = [Signature.campaign_id == campaign_id, Signature.status == "confirmed"]
    if campaign_id == _LEGACY_NULL_NAME_EXCLUSION_CAMPAIGN_ID:
        filters.append(Signature.name.is_not(None))
    result = await db.execute(select(func.count()).where(*filters))
    return result.scalar() or 0


async def get_total_signature_count(db: AsyncSession, campaign_id: uuid.UUID) -> int:
    """Confirmed + pending_confirmation — usado en la pantalla de gracias post-firma."""
    filters = [
        Signature.campaign_id == campaign_id,
        Signature.status.in_(["confirmed", "pending_confirmation"]),
    ]
    if campaign_id == _LEGACY_NULL_NAME_EXCLUSION_CAMPAIGN_ID:
        filters.append(Signature.name.is_not(None))
    result = await db.execute(select(func.count()).where(*filters))
    return result.scalar() or 0


COMPLETION_TOKEN_TTL_DAYS = 7


async def get_completion_context(db: AsyncSession, token: str) -> dict | None:
    """Valida el token de completar nombre. No consume PII, solo confirma vigencia."""
    from sqlalchemy import text as sa_text
    await db.execute(sa_text("SELECT set_config('app.is_platform_admin', 'true', true)"))

    result = await db.execute(select(Signature).where(Signature.completion_token == token))
    sig = result.scalar_one_or_none()
    if not sig or not sig.completion_token_expires_at:
        return None

    exp = sig.completion_token_expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        return None

    return {"campaign_id": sig.campaign_id}


async def complete_signature_name(db: AsyncSession, token: str, name: str) -> dict | None:
    """Completa el nombre de una firma vía el token de remediación.

    Si la firma seguía `pending_confirmation`, la promueve a `confirmed` en
    el mismo paso (consolida completar-nombre + confirmar en un solo click,
    como pidió el usuario). Token de un solo uso.
    """
    from sqlalchemy import text as sa_text
    await db.execute(sa_text("SELECT set_config('app.is_platform_admin', 'true', true)"))

    result = await db.execute(select(Signature).where(Signature.completion_token == token))
    sig = result.scalar_one_or_none()
    if not sig or not sig.completion_token_expires_at:
        return None

    exp = sig.completion_token_expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > exp:
        return None

    clean_name = name.strip()
    if len(clean_name) < 3 or " " not in clean_name:
        raise ValueError("nombre_incompleto")

    campaign_result = await db.execute(select(Campaign).where(Campaign.id == sig.campaign_id))
    campaign = campaign_result.scalar_one_or_none()
    slug = campaign.slug if campaign else None

    newly_confirmed = sig.status == "pending_confirmation"
    sig.name = clean_name
    if newly_confirmed:
        sig.status = "confirmed"
        sig.confirmed_at = datetime.now(timezone.utc)
    sig.completion_token = None
    sig.completion_token_expires_at = None
    await db.commit()

    return {"slug": slug, "newly_confirmed": newly_confirmed}
