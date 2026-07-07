from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.dependencies import get_db_with_org, get_current_user
from app.schemas.campaign import (
    CampaignCreate, CampaignUpdate, CampaignStatusUpdate, CampaignResponse,
    SocialLinksUpdate, ThankYouUpdate, WelcomeConfigUpdate, CampaignInfoUpdate,
    LifecycleStageUpdate, NotifySignersRequest, AdminCampaignDetailResponse,
    LifecycleEventOut,
)
from app.services.campaign_service import CampaignService
from app.services.email_service import (
    send_lifecycle_admin_notification,
    send_lifecycle_org_notification,
    send_lifecycle_signer_notification,
)
from app.models.user import User
from app.models.campaign import Campaign as CampaignModel
from app.models.form import Form as FormModel

router = APIRouter()


def _org_scope(user: User):
    """None para admin de plataforma (multi-org); org propia para otros roles."""
    return None if user.role == "admin" else user.org_id


async def _get_owned_campaign(campaign_id: str, current_user: User, db: AsyncSession) -> CampaignModel:
    campaign = await CampaignService.get_campaign(db, campaign_id, org_id=_org_scope(current_user))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campaign


@router.get("", response_model=list[CampaignResponse])
async def list_campaigns(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    return await CampaignService.list_campaigns(db, _org_scope(current_user))


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
    try:
        return await CampaignService.create_campaign(db, data, current_user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="El slug ya está en uso")


@router.get("/{campaign_id}", response_model=AdminCampaignDetailResponse)
async def get_campaign(campaign_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    campaign, org = await CampaignService.get_campaign_with_lifecycle(db, campaign_id, _org_scope(current_user))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    events_sorted = sorted(campaign.lifecycle_events, key=lambda e: e.registered_at, reverse=True)[:20]
    return AdminCampaignDetailResponse.model_validate({
        **CampaignResponse.model_validate(campaign).model_dump(),
        "lifecycle_events": [LifecycleEventOut.model_validate(e) for e in events_sorted],
        "org_name": org.name if org else None,
        "org_has_contact_email": bool(org and org.contact_email),
    })


@router.put("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(campaign_id: str, data: CampaignUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await _get_owned_campaign(campaign_id, current_user, db)
    try:
        campaign = await CampaignService.update_campaign(db, campaign_id, data)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="El slug ya está en uso")
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campaign


@router.patch("/{campaign_id}/status", response_model=CampaignResponse)
async def update_campaign_status(campaign_id: str, data: CampaignStatusUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    campaign = await _get_owned_campaign(campaign_id, current_user, db)
    if data.status == "active":
        missing = []
        if not campaign.category:
            missing.append("category")
        if not campaign.privacy_policy_id:
            missing.append("privacy_policy_id")
        if not campaign.ends_at:
            missing.append("ends_at")
        if missing:
            raise HTTPException(
                status_code=422,
                detail={"error": "missing_required_for_active", "missing": missing},
            )
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


@router.patch("/{campaign_id}/archive")
async def archive_campaign(campaign_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    try:
        campaign = await CampaignService.archive_campaign(db, campaign_id, _org_scope(current_user), current_user.id)
    except ValueError:
        raise HTTPException(status_code=409, detail={"error": "campaign_activa", "msg": "Desactiva la campaña antes de archivarla"})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return {"ok": True}


@router.patch("/{campaign_id}/lifecycle")
async def update_lifecycle(
    campaign_id: str,
    data: LifecycleStageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    campaign, org = await CampaignService.get_campaign_with_lifecycle(db, campaign_id, _org_scope(current_user))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if campaign.archived_at is not None:
        raise HTTPException(status_code=409, detail="No se puede modificar el ciclo de vida de una campaña archivada")

    # Etapas opcionales por campaña (meta.lifecycle_config): 3=Diálogo, 4=Decisión
    lc_config = (campaign.meta or {}).get("lifecycle_config", {})
    if (data.stage == 3 and lc_config.get("dialogo") is False) or (
        data.stage == 4 and lc_config.get("decision") is False
    ):
        raise HTTPException(status_code=422, detail="Etapa deshabilitada para esta campaña")

    old_stage = campaign.lifecycle_stage
    event = await CampaignService.update_lifecycle_stage(db, campaign, data.stage, data.notes, current_user.id)

    notifications_sent: list[str] = []
    await send_lifecycle_admin_notification(
        campaign_title=campaign.title,
        org_name=org.name if org else "",
        old_stage_index=old_stage,
        new_stage_index=data.stage,
        notes=data.notes,
        changed_by_email=current_user.email if hasattr(current_user, "email") else None,
    )
    notifications_sent.append("admins")

    if data.notify_org and org and org.contact_email:
        await send_lifecycle_org_notification(
            to_email=org.contact_email,
            campaign_title=campaign.title,
            new_stage_index=data.stage,
            notes=data.notes,
        )
        notifications_sent.append("org")

    return {
        "lifecycle_stage": campaign.lifecycle_stage,
        "event": LifecycleEventOut.model_validate(event),
        "notifications_sent": notifications_sent,
    }


@router.post("/{campaign_id}/lifecycle/notify-signers")
async def notify_signers(
    campaign_id: str,
    data: NotifySignersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    campaign = await CampaignService.get_campaign(db, campaign_id, org_id=_org_scope(current_user))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if campaign.archived_at is not None:
        raise HTTPException(status_code=409, detail="Campaña archivada")

    emails = await CampaignService.get_signer_emails_for_notify(db, campaign.id)
    sent_count = await send_lifecycle_signer_notification(
        emails=emails,
        campaign_title=campaign.title,
        current_stage_index=campaign.lifecycle_stage,
        message=data.message,
    )
    return {"sent_count": sent_count}


@router.get("/{campaign_id}/qr")
async def get_qr(campaign_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await _get_owned_campaign(campaign_id, current_user, db)
    return await CampaignService.get_qr(db, campaign_id)
