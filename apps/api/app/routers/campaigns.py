from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.dependencies import get_db_with_org, get_current_user
from app.limiter import limiter
from app.schemas.campaign import (
    CampaignCreate, CampaignUpdate, CampaignStatusUpdate, CampaignResponse,
    SocialLinksUpdate, ThankYouUpdate, WelcomeConfigUpdate, CampaignInfoUpdate,
    LifecycleStageUpdate, NotifySignersRequest, AdminCampaignDetailResponse,
    LifecycleEventOut, EventInvitationRequest, ClosingNotificationRequest,
)
from app.schemas.comms import CommsPreviewRequest, CommsQuotaResponse, CommsSendRequest, RecipientsCountRequest
from app.services.campaign_service import CampaignService
from app.services.comms_service import (
    AudienceFilter, CtaButton, InvalidCommsType, UploadRejected, build_comms_email_html,
    comms_upload_url, count_recipients, get_recipients, sanitize_comms_html, save_comms_upload,
)
from app.services.email_service import (
    _send,
    send_lifecycle_admin_notification,
    send_lifecycle_org_notification,
    send_lifecycle_signer_notification,
    send_delivery_event_invitation_email,
    send_campaign_closing_email,
    _build_delivery_event_invitation_html,
    _build_campaign_closing_html,
)
from app.services.email_quota import PLATFORM_QUOTA_KEY, get_usage
from app.services.email_transport import platform_transport, resolve_sender, transport_from_config
from app.services.org_email_config_service import OrgEmailConfigService
from app.services.signature_service import get_signature_count
from app.models.user import User
from app.models.campaign import Campaign as CampaignModel
from app.models.form import Form as FormModel

_COMMS_HEADING = {
    "general": "Novedades de la campaña",
    "invitation": "Invitación",
    "closing": "Aviso de cierre",
}


def _audience_filter(a) -> AudienceFilter:
    return AudienceFilter(
        include_confirmed=a.include_confirmed,
        include_pending=a.include_pending,
        signer_types=a.signer_types,
        locations=a.locations,
        visibilities=a.visibilities,
    )


async def _resolve_campaign_email_context(db: AsyncSession, campaign: CampaignModel, org):
    """Transporte + remitente + clave de cuota resueltos por config-email-org
    (R16, R17) — el centro nunca define proveedor/credenciales propias."""
    cfg = await OrgEmailConfigService.get(db, campaign.org_id)
    active_cfg = cfg if (cfg and cfg.status == "active") else None
    transport = transport_from_config(active_cfg) if active_cfg else platform_transport()
    sender = resolve_sender(campaign.meta, active_cfg, org)
    quota_key = str(active_cfg.id) if active_cfg else PLATFORM_QUOTA_KEY
    return transport, sender, quota_key

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


@router.post("/{campaign_id}/lifecycle/event-invitation/preview")
async def preview_event_invitation(
    campaign_id: str,
    data: EventInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    campaign, org = await CampaignService.get_campaign_with_lifecycle(db, campaign_id, _org_scope(current_user))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    html = _build_delivery_event_invitation_html(
        campaign_title=campaign.petition_title or campaign.title,
        event_title=data.event_title or "Entrega de la petición",
        event_subtitle=data.event_subtitle,
        event_datetime=data.event_datetime,
        event_location=data.event_location,
        event_map_url=data.event_map_url,
        event_image_url=data.event_image_url,
        message=data.message,
        signer_name="Nombre Apellido",
        social_links=campaign.social_links,
        org_name=org.name if org else "",
        org_logo_url=(org.logo_url or "") if org else "",
    )
    recipient_count = len(await CampaignService.get_signer_emails_nacional_confirmed(db, campaign.id))
    return {"html": html, "recipient_count": recipient_count}


@router.post("/{campaign_id}/lifecycle/event-invitation")
@limiter.limit("5/minute")
async def send_event_invitation(
    request: Request,
    campaign_id: str,
    data: EventInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    campaign, org = await CampaignService.get_campaign_with_lifecycle(db, campaign_id, _org_scope(current_user))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if campaign.archived_at is not None:
        raise HTTPException(status_code=409, detail="Campaña archivada")

    if data.test_emails:
        recipients = [(email, "Nombre Apellido") for email in data.test_emails]
    else:
        recipients = await CampaignService.get_signer_emails_and_names_nacional_confirmed(db, campaign.id)

    sent_count = await send_delivery_event_invitation_email(
        recipients,
        campaign_title=campaign.petition_title or campaign.title,
        event_title=data.event_title,
        event_subtitle=data.event_subtitle,
        event_datetime=data.event_datetime,
        event_location=data.event_location,
        event_map_url=data.event_map_url,
        event_image_url=data.event_image_url,
        message=data.message,
        subject_override=data.subject,
        social_links=campaign.social_links,
        org_name=org.name if org else "",
        org_logo_url=(org.logo_url or "") if org else "",
    )
    return {"sent_count": sent_count, "mode": "test" if data.test_emails else "real"}


@router.post("/{campaign_id}/lifecycle/closing-notification/preview")
async def preview_closing_notification(
    campaign_id: str,
    data: ClosingNotificationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    campaign, org = await CampaignService.get_campaign_with_lifecycle(db, campaign_id, _org_scope(current_user))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    final_count = await get_signature_count(db, campaign.id)
    html = _build_campaign_closing_html(
        campaign_title=campaign.petition_title or campaign.title,
        final_count=final_count,
        social_links=campaign.social_links,
        subtitle=data.subtitle,
        image_url=data.image_url,
        message=data.message,
        signer_name="Nombre Apellido",
        org_name=org.name if org else "",
        org_logo_url=(org.logo_url or "") if org else "",
    )
    recipient_count = len(await CampaignService.get_signer_emails_todos_confirmed(db, campaign.id))
    return {"html": html, "final_count": final_count, "recipient_count": recipient_count}


@router.post("/{campaign_id}/lifecycle/closing-notification")
@limiter.limit("5/minute")
async def send_closing_notification(
    request: Request,
    campaign_id: str,
    data: ClosingNotificationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    campaign, org = await CampaignService.get_campaign_with_lifecycle(db, campaign_id, _org_scope(current_user))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if campaign.archived_at is not None:
        raise HTTPException(status_code=409, detail="Campaña archivada")

    final_count = await get_signature_count(db, campaign.id)
    if data.test_emails:
        recipients = [(email, "Nombre Apellido") for email in data.test_emails]
    else:
        recipients = await CampaignService.get_signer_emails_and_names_todos_confirmed(db, campaign.id)

    sent_count = await send_campaign_closing_email(
        recipients,
        campaign_title=campaign.petition_title or campaign.title,
        final_count=final_count,
        social_links=campaign.social_links,
        subtitle=data.subtitle,
        image_url=data.image_url,
        message=data.message,
        subject_override=data.subject,
        org_name=org.name if org else "",
        org_logo_url=(org.logo_url or "") if org else "",
    )
    return {"sent_count": sent_count, "final_count": final_count, "mode": "test" if data.test_emails else "real"}


# ── Centro de comunicaciones (centro-comunicaciones, Fase 1) ─────────────────

@router.get("/{campaign_id}/comms/quota", response_model=CommsQuotaResponse)
async def comms_quota(
    campaign_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    """R21: cuota del proveedor resuelto por config-email-org, con scope de
    campaña (a diferencia de GET /organizaciones/{id}/email-config, que es
    platform_admin-only — un gestor sin ese rol también necesita ver esto)."""
    campaign, org = await CampaignService.get_campaign_with_lifecycle(db, campaign_id, _org_scope(current_user))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")

    cfg = await OrgEmailConfigService.get(db, campaign.org_id)
    active_cfg = cfg if (cfg and cfg.status == "active") else None
    transport = transport_from_config(active_cfg) if active_cfg else platform_transport()
    caps = transport.capabilities()
    quota_key = str(active_cfg.id) if active_cfg else PLATFORM_QUOTA_KEY
    usage = await get_usage(quota_key)
    sender = resolve_sender(campaign.meta, active_cfg, org)

    return CommsQuotaResponse(
        provider=active_cfg.provider if active_cfg else "resend",
        plan=(active_cfg.plan if active_cfg and active_cfg.plan else "free"),
        daily_used=usage["daily_used"],
        daily_quota=(active_cfg.daily_quota if active_cfg and active_cfg.daily_quota is not None else caps.daily_quota),
        monthly_used=usage["monthly_used"],
        monthly_quota=(active_cfg.monthly_quota if active_cfg and active_cfg.monthly_quota is not None else caps.monthly_quota),
        updated_at=(usage["provider_snapshot"]["updated_at"] if usage["provider_snapshot"] else None),
        sender=sender["from_"],
        org_name=org.name if org else "",
    )


@router.post("/{campaign_id}/comms/uploads")
@limiter.limit("20/minute")
async def comms_upload(
    request: Request,
    campaign_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    """R4/R19/D2: sube una imagen para insertar en el editor del centro de
    comunicaciones. Se guarda en el volumen (settings.uploads_dir) y se
    referencia por URL pública — nunca como adjunto pesado del email."""
    campaign = await _get_owned_campaign(campaign_id, current_user, db)
    data = await file.read(settings.comms_upload_max_bytes + 1)
    try:
        upload = await save_comms_upload(
            db, org_id=campaign.org_id, campaign_id=campaign.id, data=data, created_by=current_user.id,
        )
    except UploadRejected as e:
        if e.reason == "too_large":
            raise HTTPException(status_code=413, detail="Archivo demasiado grande (máx. 25 MB)")
        raise HTTPException(status_code=400, detail="Formato no permitido — solo JPG, PNG, WEBP o GIF")
    return {"id": str(upload.id), "url": comms_upload_url(upload)}


@router.post("/{campaign_id}/comms/recipients/count")
async def comms_recipients_count(
    campaign_id: str,
    data: RecipientsCountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    """R10: conteo en vivo del segmento seleccionado."""
    campaign = await _get_owned_campaign(campaign_id, current_user, db)
    try:
        count = await count_recipients(db, campaign.id, data.type, _audience_filter(data.audience))
    except InvalidCommsType:
        raise HTTPException(status_code=400, detail="Tipo de comunicación inválido")
    return {"count": count}


@router.post("/{campaign_id}/comms/preview")
async def comms_preview(
    campaign_id: str,
    data: CommsPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    """R7: vista previa real — mismo armado de HTML que el envío."""
    campaign, org = await CampaignService.get_campaign_with_lifecycle(db, campaign_id, _org_scope(current_user))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if data.type not in _COMMS_HEADING:
        raise HTTPException(status_code=400, detail="Tipo de comunicación inválido")

    sanitized = sanitize_comms_html(data.body_html)
    html = build_comms_email_html(
        org_name=org.name if org else "",
        org_logo_url=(org.logo_url or "") if org else "",
        heading=_COMMS_HEADING[data.type],
        body_html=sanitized,
        ctas=[CtaButton(text=c.text, url=c.url, enabled=c.enabled) for c in data.ctas],
        include_social=data.include_social,
        social_links=campaign.social_links,
        signer_name="Nombre Apellido",
    )
    return {"html": html}


@router.post("/{campaign_id}/comms/send")
@limiter.limit("5/minute")
async def comms_send(
    request: Request,
    campaign_id: str,
    data: CommsSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    """Envío inmediato (real o de prueba) del centro de comunicaciones (Fase 1,
    sin cola/programación todavía). R16/R17: remitente y cuota resueltos por
    config-email-org, nunca definidos acá."""
    campaign, org = await CampaignService.get_campaign_with_lifecycle(db, campaign_id, _org_scope(current_user))
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if campaign.archived_at is not None:
        raise HTTPException(status_code=409, detail="Campaña archivada")
    if data.type not in _COMMS_HEADING:
        raise HTTPException(status_code=400, detail="Tipo de comunicación inválido")

    sanitized = sanitize_comms_html(data.body_html)
    ctas = [CtaButton(text=c.text, url=c.url, enabled=c.enabled) for c in data.ctas]

    if data.test_emails:
        recipients = [(email, "Nombre Apellido") for email in data.test_emails]
    else:
        recipients = await get_recipients(db, campaign.id, data.type, _audience_filter(data.audience))

    transport, sender, quota_key = await _resolve_campaign_email_context(db, campaign, org)

    sent_count = 0
    for email, name in recipients:
        html = build_comms_email_html(
            org_name=org.name if org else "",
            org_logo_url=(org.logo_url or "") if org else "",
            heading=_COMMS_HEADING[data.type],
            body_html=sanitized,
            ctas=ctas,
            include_social=data.include_social,
            social_links=campaign.social_links,
            signer_name=name,
        )
        ok = await _send(
            email, data.subject, html,
            transport=transport, from_=sender["from_"], reply_to=sender["reply_to"],
            quota_key=quota_key,
        )
        if ok:
            sent_count += 1

    return {
        "sent_count": sent_count,
        "recipient_count": len(recipients),
        "mode": "test" if data.test_emails else "real",
    }


@router.get("/{campaign_id}/qr")
async def get_qr(campaign_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await _get_owned_campaign(campaign_id, current_user, db)
    return await CampaignService.get_qr(db, campaign_id)
