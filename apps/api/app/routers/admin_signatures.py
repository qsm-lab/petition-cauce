import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db_with_org, get_current_user
from app.models.user import User
from app.models.campaign import Campaign
from app.services.admin_signature_service import AdminSignatureService

router = APIRouter()


async def _get_campaign(campaign_id: str, org_id: uuid.UUID, db: AsyncSession) -> Campaign:
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.org_id == org_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campaign


@router.get("/campaigns/{campaign_id}/signatures")
async def list_signatures(
    campaign_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    provincia: str | None = None,
    visibility: str | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    if current_user.role not in ("admin", "gestor"):
        raise HTTPException(status_code=403, detail="Acceso denegado")
    campaign = await _get_campaign(campaign_id, current_user.org_id, db)
    return await AdminSignatureService.list_signatures(
        db,
        campaign_id=campaign.id,
        org_id=current_user.org_id,
        campaign_title=campaign.title,
        campaign_slug=campaign.slug,
        page=page,
        per_page=per_page,
        provincia=provincia,
        visibility=visibility,
        status=status,
    )


@router.get("/campaigns/{campaign_id}/signatures/export.csv")
async def export_signatures_csv(
    campaign_id: str,
    provincia: str | None = None,
    visibility: str | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    if current_user.role not in ("admin", "gestor"):
        raise HTTPException(status_code=403, detail="Acceso denegado")
    campaign = await _get_campaign(campaign_id, current_user.org_id, db)
    return await AdminSignatureService.export_csv(
        db,
        campaign_id=campaign.id,
        org_id=current_user.org_id,
        slug=campaign.slug,
        provincia=provincia,
        visibility=visibility,
        status=status,
    )
