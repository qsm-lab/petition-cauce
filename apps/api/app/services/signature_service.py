import logging
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.privacy_config import PrivacyConfig
from app.models.signature import Signature
from app.crypto import compute_hmac, verify_cedula
from app.schemas.signature import SignatureCreate

logger = logging.getLogger(__name__)

_TOKEN_TTL_HOURS = 24


async def create_signature(
    db: AsyncSession,
    campaign: Campaign,
    data: SignatureCreate,
    ip_hmac: str,
) -> Signature:
    """Persiste Signature + Consent. Lanza ValueError con código en caso de error lógico."""

    if not verify_cedula(data.cedula):
        raise ValueError("cedula_invalida")

    email_normalized = data.email.strip().lower()
    email_hash = compute_hmac(email_normalized)
    cedula_hash = compute_hmac(data.cedula)

    token = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_TTL_HOURS)

    pc_result = await db.execute(
        select(PrivacyConfig).where(PrivacyConfig.campaign_id == campaign.id)
    )
    pc = pc_result.scalar_one_or_none()
    text_snapshot = pc.aviso_privacidad if pc else ""
    aviso_version = str(pc.version) if pc else "1"

    # Fase 1: email/cedula stored as-is in _encrypted fields; AES-256-GCM added in Fase 3 (cifrado-reposo)
    sig = Signature(
        campaign_id=campaign.id,
        org_id=campaign.org_id,
        name=data.name.strip() if data.visibility == "publica" else None,
        email_encrypted=email_normalized,
        email_hash=email_hash,
        cedula_encrypted=data.cedula,
        cedula_hash=cedula_hash,
        provincia=data.provincia,
        signer_type="natural",
        visibility=data.visibility,
        status="pending_confirmation",
        confirmation_token=token,
        confirmation_token_expires_at=expires_at,
        ip_hmac=ip_hmac,
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
        legal_basis="consentimiento_expreso",
        ip_hmac=ip_hmac,
        subscribe_newsletter=data.subscribe_newsletter,
    )
    db.add(consent)
    await db.flush()

    logger.info("[dev] confirmation_token=%s campaign=%s", token, campaign.id)

    await db.commit()
    await db.refresh(sig)
    return sig


async def confirm_signature(db: AsyncSession, token: str) -> dict | None:
    """Confirma firma por token. Retorna {count, goal} o None si el token no existe/expiró."""
    result = await db.execute(
        select(Signature).where(
            Signature.confirmation_token == token,
            Signature.status == "pending_confirmation",
        )
    )
    sig = result.scalar_one_or_none()
    if not sig:
        return None

    now = datetime.now(timezone.utc)
    if sig.confirmation_token_expires_at:
        exp = sig.confirmation_token_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if now > exp:
            return None

    sig.status = "confirmed"
    sig.confirmed_at = now
    sig.confirmation_token = None
    await db.flush()

    count_result = await db.execute(
        select(func.count()).where(
            Signature.campaign_id == sig.campaign_id,
            Signature.status == "confirmed",
        )
    )
    count = count_result.scalar() or 0

    campaign_result = await db.execute(
        select(Campaign).where(Campaign.id == sig.campaign_id)
    )
    campaign = campaign_result.scalar_one_or_none()

    await db.commit()
    return {"count": count, "goal": campaign.goal_count if campaign else None}


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
            "provincia": sig.provincia or "",
            "time_ago": time_ago,
            "is_anon": sig.name is None,
        })
    return items


async def get_signature_count(db: AsyncSession, campaign_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).where(
            Signature.campaign_id == campaign_id,
            Signature.status == "confirmed",
        )
    )
    return result.scalar() or 0
