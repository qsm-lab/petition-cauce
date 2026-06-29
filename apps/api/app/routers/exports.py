from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_with_org, get_current_user
from app.services.export_service import ExportService
from app.services.campaign_service import CampaignService
from app.models.user import User

router = APIRouter()


@router.get("/{campaign_id}")
async def export(
    campaign_id: str,
    format: str = Query(default="csv", regex="^(csv|xlsx|json)$"),
    anonymized: bool = True,
    date_from: str | None = None,
    date_to: str | None = None,
    status: str = "completed",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    campaign = await CampaignService.get_campaign(db, campaign_id, org_id=current_user.org_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return await ExportService.export(db, campaign_id, format, anonymized, date_from, date_to, status)


@router.get("/{campaign_id}/preview")
async def export_preview(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    campaign = await CampaignService.get_campaign(db, campaign_id, org_id=current_user.org_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return await ExportService.preview(db, campaign_id)
