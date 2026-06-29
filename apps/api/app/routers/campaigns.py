from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import get_db_with_org, get_current_user
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignStatusUpdate, CampaignResponse, SocialLinksUpdate, ThankYouUpdate, WelcomeConfigUpdate, CampaignInfoUpdate
from app.services.campaign_service import CampaignService
from app.models.user import User
from app.models.campaign import Campaign as CampaignModel
from app.models.form import Form as FormModel

router = APIRouter()


async def _get_owned_campaign(campaign_id: str, current_user: User, db: AsyncSession) -> CampaignModel:
    campaign = await CampaignService.get_campaign(db, campaign_id, org_id=current_user.org_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campaign


@router.get("", response_model=list[CampaignResponse])
async def list_campaigns(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    return await CampaignService.list_campaigns(db, current_user.org_id)


@router.get("/by-form/{form_id}", response_model=CampaignResponse)
async def get_campaign_by_form(form_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    result = await db.execute(
        select(CampaignModel)
        .join(FormModel, CampaignModel.form_id == FormModel.id)
        .where(CampaignModel.form_id == form_id, FormModel.org_id == current_user.org_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="No hay campaña vinculada a este formulario")
    return campaign


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(data: CampaignCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    return await CampaignService.create_campaign(db, data, current_user)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    return await _get_owned_campaign(campaign_id, current_user, db)


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: str, data: CampaignUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await _get_owned_campaign(campaign_id, current_user, db)
    campaign = await CampaignService.update_campaign(db, campaign_id, data)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campaign


@router.patch("/{campaign_id}/status", response_model=CampaignResponse)
async def update_campaign_status(campaign_id: str, data: CampaignStatusUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await _get_owned_campaign(campaign_id, current_user, db)
    return await CampaignService.update_status(db, campaign_id, data.status)


@router.patch("/{campaign_id}/info", response_model=CampaignResponse)
async def update_campaign_info(campaign_id: str, data: CampaignInfoUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await _get_owned_campaign(campaign_id, current_user, db)
    campaign = await CampaignService.update_info(db, campaign_id, data)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campaign


@router.patch("/{campaign_id}/social-links", response_model=CampaignResponse)
async def update_social_links(campaign_id: str, data: SocialLinksUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await _get_owned_campaign(campaign_id, current_user, db)
    campaign = await CampaignService.update_social_links(db, campaign_id, data)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campaign


@router.patch("/{campaign_id}/thank-you", response_model=CampaignResponse)
async def update_thank_you(campaign_id: str, data: ThankYouUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await _get_owned_campaign(campaign_id, current_user, db)
    campaign = await CampaignService.update_thank_you(db, campaign_id, data)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campaign


@router.patch("/{campaign_id}/welcome-config", response_model=CampaignResponse)
async def update_welcome_config(campaign_id: str, data: WelcomeConfigUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await _get_owned_campaign(campaign_id, current_user, db)
    campaign = await CampaignService.update_welcome_config(db, campaign_id, data)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campaign


@router.get("/{campaign_id}/qr")
async def get_qr(campaign_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await _get_owned_campaign(campaign_id, current_user, db)
    return await CampaignService.get_qr(db, campaign_id)
