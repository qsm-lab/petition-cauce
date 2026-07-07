from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_with_org, get_current_user
from app.services.campaign_service import CampaignService
from app.models.user import User

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    org_scope = None if current_user.role == "admin" else current_user.org_id
    return await CampaignService.get_dashboard_summary(db, org_scope)


@router.get("/campaigns/{campaign_id}/stats")
async def campaign_stats(campaign_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    return await CampaignService.get_stats(db, campaign_id)
