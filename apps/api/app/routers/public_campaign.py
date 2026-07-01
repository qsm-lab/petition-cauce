import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import compute_hmac
from app.dependencies import get_db
from app.limiter import limiter
from app.models.campaign import Campaign
from app.models.organization import Organization
from app.models.privacy_config import PrivacyConfig
from app.schemas.signature import SignatureCreate
from app.services.signature_service import (
    confirm_signature,
    create_signature,
    get_recent_signatures,
    get_signature_count,
)
from app.services.turnstile_service import verify_turnstile

router = APIRouter()


async def _get_active_campaign(db: AsyncSession, campaign_id: str) -> Campaign:
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    result = await db.execute(select(Campaign).where(Campaign.id == cid))
    campaign = result.scalar_one_or_none()
    if not campaign or campaign.archived_at is not None:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campaign


def _serialize(campaign: Campaign, org: Organization | None, count: int) -> dict:
    return {
        "id": str(campaign.id),
        "slug": campaign.slug,
        "title": campaign.title,
        "status": campaign.status,
        "category": campaign.category,
        "authority": campaign.authority,
        "asks": campaign.asks or [],
        "petition_body": campaign.petition_body or {},
        "hero_image_url": campaign.hero_image_url,
        "lifecycle_stage": campaign.lifecycle_stage,
        "goal_count": campaign.goal_count,
        "signature_count": count,
        "signer_type": campaign.signer_type,
        "meta": campaign.meta or {},
        "org": {
            "id": str(campaign.org_id),
            "name": org.name if org else "",
            "initial": (org.name or "?")[0].upper() if org else "?",
        },
    }


@router.get("/by-slug/{slug}")
async def get_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.slug == slug))
    campaign = result.scalar_one_or_none()
    if not campaign or campaign.archived_at is not None:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    org_result = await db.execute(select(Organization).where(Organization.id == campaign.org_id))
    org = org_result.scalar_one_or_none()
    count = await get_signature_count(db, campaign.id)
    return _serialize(campaign, org, count)


@router.get("/{campaign_id}/privacy")
async def get_privacy(campaign_id: str, db: AsyncSession = Depends(get_db)):
    campaign = await _get_active_campaign(db, campaign_id)
    pc_result = await db.execute(
        select(PrivacyConfig).where(PrivacyConfig.campaign_id == campaign.id)
    )
    pc = pc_result.scalar_one_or_none()
    if not pc:
        raise HTTPException(status_code=404, detail="Privacy config no encontrada")
    return {
        "aviso_privacidad": pc.aviso_privacidad,
        "version": pc.version,
        "base_legal": pc.base_legal,
        "data_contact_email": pc.data_contact_email,
    }


@router.get("/{campaign_id}/signatures/recent")
async def recent_signatures(
    campaign_id: str,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_active_campaign(db, campaign_id)
    return await get_recent_signatures(db, campaign.id, min(limit, 20))


@router.post("/{campaign_id}/signatures", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def submit_signature(
    campaign_id: str,
    request: Request,
    data: SignatureCreate,
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_active_campaign(db, campaign_id)

    if not await verify_turnstile(data.cf_turnstile_token):
        raise HTTPException(status_code=422, detail={"error": "turnstile_failed"})

    ip = (
        request.headers.get("CF-Connecting-IP")
        or request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )
    ip_hmac = compute_hmac(ip)

    await db.execute(
        text("SELECT set_config('app.current_org_id', :org_id, true)"),
        {"org_id": str(campaign.org_id)},
    )

    try:
        sig = await create_signature(db, campaign, data, ip_hmac)
    except ValueError as e:
        code = str(e)
        if code == "ya_firmaste":
            raise HTTPException(
                status_code=409,
                detail={"error": "ya_firmaste", "campaign_id": campaign_id},
            )
        if code == "cedula_invalida":
            raise HTTPException(
                status_code=422,
                detail={"field": "cedula", "error": "cedula_invalida"},
            )
        raise HTTPException(status_code=422, detail={"error": code})

    return {"id": str(sig.id), "status": sig.status}


@router.get("/confirm/{token}")
async def confirm_sig(token: str, db: AsyncSession = Depends(get_db)):
    result = await confirm_signature(db, token)
    if not result:
        raise HTTPException(status_code=404, detail="Token inválido o expirado")
    return result


@router.get("/{campaign_id}")
async def get_campaign_public(campaign_id: str, db: AsyncSession = Depends(get_db)):
    campaign = await _get_active_campaign(db, campaign_id)
    org_result = await db.execute(select(Organization).where(Organization.id == campaign.org_id))
    org = org_result.scalar_one_or_none()
    count = await get_signature_count(db, campaign.id)
    return _serialize(campaign, org, count)
