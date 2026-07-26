import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import compute_hmac
from app.dependencies import get_db
from app.limiter import limiter
from app.models.campaign import Campaign
from app.models.organization import Organization
from app.models.privacy_config import PrivacyConfig
from app.models.privacy_policy import PrivacyPolicy
from app.models.signature import Signature
from app.schemas.signature import (
    CompleteNameRequest,
    NewsletterConsentRequest,
    ResendConfirmationRequest,
    SignatureCreate,
)
from app.services.email_service import send_confirmation_email
from app.services.signature_service import (
    complete_signature_name,
    confirm_signature,
    create_signature,
    get_completion_context,
    get_recent_signatures,
    get_signature_count,
    get_total_signature_count,
    set_newsletter_consent,
)
from app.services.turnstile_service import verify_turnstile

router = APIRouter()


_SIGNABLE_STATUSES = {"draft", "active", "online"}


async def _get_active_campaign(db: AsyncSession, campaign_id: str) -> Campaign:
    """Campaña pública (no archivada). No valida si acepta firmas — usar _get_signable_campaign para submit."""
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    result = await db.execute(select(Campaign).where(Campaign.id == cid))
    campaign = result.scalar_one_or_none()
    if not campaign or campaign.archived_at is not None:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return campaign


async def _get_signable_campaign(db: AsyncSession, campaign_id: str) -> Campaign:
    """Campañas que aceptan firmas (draft=prueba, active/online=real, closed→409)."""
    campaign = await _get_active_campaign(db, campaign_id)
    if campaign.status not in _SIGNABLE_STATUSES:
        raise HTTPException(status_code=409, detail={"error": "campana_cerrada"})
    return campaign


_DEFAULT_FORM_CONFIG = {
    "signer_types": ["natural"],
    "location_modes": ["nacional"],
    "required_fields": ["nombre", "email", "cedula", "location"],
    "visibility_options": ["publica", "anonima"],
    "request_celular": False,
}


def _serialize(campaign: Campaign, org: Organization | None, count: int, total_count: int | None = None) -> dict:
    meta = campaign.meta or {}
    raw_fc = meta.get("form_config", {})
    form_config = {**_DEFAULT_FORM_CONFIG, **raw_fc}

    show_authority = meta.get("show_authority", True)
    show_goal = meta.get("show_goal", True)
    is_draft = campaign.status == "draft"

    show_qr = bool(meta.get("show_qr", False))
    return {
        "id": str(campaign.id),
        "slug": campaign.slug,
        "title": campaign.title,
        "petition_title": campaign.petition_title or campaign.title,
        "status": campaign.status,
        "is_draft": is_draft,
        "category": campaign.category,
        "authority": campaign.authority,
        "show_authority": show_authority,
        "show_goal": show_goal,
        "asks": campaign.asks or [],
        "petition_body": campaign.petition_body or {},
        "hero_image_url": campaign.hero_image_url,
        "hero_image_mobile_url": meta.get("hero_image_mobile_url"),
        "attachments": meta.get("attachments", []),
        "show_qr": show_qr,
        "qr_code_data": campaign.qr_code_data if show_qr else None,
        "share_text": meta.get("share_text"),
        "lifecycle_stage": campaign.lifecycle_stage,
        "goal_count": campaign.goal_count if show_goal else None,
        "signature_count": count,
        "total_count": total_count if total_count is not None else count,
        "signer_type": campaign.signer_type,
        "form_config": form_config,
        "meta": meta,
        "org": {
            "id": str(campaign.org_id),
            "name": org.name if org else "",
            "initial": (org.name or "?")[0].upper() if org else "?",
            "logo_url": org.logo_url if org else None,
            # Datos institucionales del Responsable (no PII de firmantes) — OrgCard expandible
            "description": org.description if org else None,
            "contact_email": org.contact_email if org else None,
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
    total = await get_total_signature_count(db, campaign.id)
    return _serialize(campaign, org, count, total)


@router.get("/{campaign_id}/privacy")
async def get_privacy(campaign_id: str, db: AsyncSession = Depends(get_db)):
    campaign = await _get_active_campaign(db, campaign_id)

    # Fuente principal: la política asignada en el admin (privacy_policies).
    if campaign.privacy_policy_id:
        # privacy_policies tiene RLS por org y la política puede pertenecer a la org
        # plataforma (Encargado) mientras la campaña es de una org cliente — lectura
        # puntual por FK, transaction-local, solo expone el aviso público.
        await db.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))
        pp_result = await db.execute(
            select(PrivacyPolicy).where(
                PrivacyPolicy.id == campaign.privacy_policy_id,
                PrivacyPolicy.archived_at.is_(None),
            )
        )
        pp = pp_result.scalar_one_or_none()
        if pp:
            return {
                "aviso_privacidad": pp.aviso_firmante,
                "version": pp.version,
                "base_legal": pp.base_legal,
                "data_contact_email": pp.data_contact_email,
            }

    # Fallback legacy: privacy_config por campaña (modelo-base).
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
    campaign = await _get_signable_campaign(db, campaign_id)

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

    is_test = campaign.status == "draft"

    try:
        sig = await create_signature(db, campaign, data, ip_hmac, is_test=is_test)
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

    return {
        "id": str(sig.id),
        "status": sig.status,
        # Token efímero para setear el consentimiento de Anuncios desde StepThanks
        # (embudo-post-firma, R5).
        "newsletter_token": sig.newsletter_token,
    }


@router.post("/{campaign_id}/signatures/resend-confirmation", status_code=204)
@limiter.limit("3/minute")
async def resend_confirmation_email(
    campaign_id: str,
    request: Request,
    data: ResendConfirmationRequest,
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_signable_campaign(db, campaign_id)
    email_normalized = data.email.strip().lower()
    email_hash = compute_hmac(email_normalized)

    result = await db.execute(
        select(Signature).where(
            Signature.campaign_id == campaign.id,
            Signature.email_hash == email_hash,
            Signature.status == "pending_confirmation",
        )
    )
    sig = result.scalar_one_or_none()

    # Always 204 — never reveal whether the email exists
    if sig and sig.confirmation_token:
        try:
            org_result = await db.execute(
                select(Organization).where(Organization.id == campaign.org_id)
            )
            org = org_result.scalar_one_or_none()
            from app.services.signature_service import build_privacy_url

            await send_confirmation_email(
                to_email=email_normalized,
                token=sig.confirmation_token,
                campaign_title=campaign.petition_title or campaign.title,
                signer_name=sig.name or "",
                org_name=org.name if org else "",
                org_logo_url=(org.logo_url or "") if org else "",
                visibility=sig.visibility,
                privacy_url=build_privacy_url(campaign.slug),
                org_contact_email=(org.contact_email or "") if org else "",
            )
        except Exception:
            pass

    return Response(status_code=204)


@router.get("/confirm/{token}")
async def confirm_sig(token: str, db: AsyncSession = Depends(get_db)):
    """Confirma la firma y redirige a la landing (el enlace se abre desde el email)."""
    from fastapi.responses import RedirectResponse
    from app.config import settings

    app_url = (settings.next_public_app_url or "http://localhost:3002").rstrip("/")
    result = await confirm_signature(db, token)

    if not result or not result.get("slug"):
        return RedirectResponse(f"{app_url}/", status_code=302)

    slug = result["slug"]
    estado = "1" if result["status"] == "confirmed" else "expirada"
    dest = f"{app_url}/c/{slug}?confirmada={estado}"
    # El nombre (si la firma es pública) alimenta el popup de compartir en la landing
    if estado == "1" and result.get("name"):
        from urllib.parse import quote

        dest += f"&nombre={quote(result['name'])}"
    return RedirectResponse(dest, status_code=302)


@router.get("/complete/{token}")
@limiter.limit("20/minute")
async def check_completion_token(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Valida el token del popup de completar nombre (remediación histórica)."""
    ctx = await get_completion_context(db, token)
    if not ctx:
        raise HTTPException(status_code=404, detail="Enlace inválido o expirado")
    return {"valid": True}


@router.post("/complete/{token}")
@limiter.limit("10/minute")
async def submit_completion_name(
    token: str, data: CompleteNameRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    """Completa el nombre de la firma; si seguía pending_confirmation, la confirma también."""
    try:
        result = await complete_signature_name(db, token, data.name)
    except ValueError:
        raise HTTPException(status_code=422, detail="Ingresá tu nombre completo (nombre y apellido)")
    if not result:
        raise HTTPException(status_code=404, detail="Enlace inválido o expirado")
    return {"ok": True, "newly_confirmed": result["newly_confirmed"]}


@router.patch("/signatures/newsletter-consent", status_code=204)
@limiter.limit("10/minute")
async def newsletter_consent(
    data: NewsletterConsentRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    """Setea el consentimiento de Anuncios de una firma recién creada, autorizado
    por su `newsletter_token` efímero (embudo-post-firma). Respuesta genérica sin
    PII: 204 si se aplicó, 404 si el token es inválido/expirado (R6)."""
    ok = await set_newsletter_consent(db, data.token, data.notify_updates)
    if not ok:
        raise HTTPException(status_code=404, detail="Enlace inválido o expirado")
    return Response(status_code=204)


@router.get("/confirm-visibility/{token}")
async def confirm_visibility_change(token: str, db: AsyncSession = Depends(get_db)):
    """Aplica el cambio de visibilidad solicitado por admin, confirmado por el titular."""
    from datetime import datetime, timezone as tz

    from fastapi.responses import RedirectResponse
    from app.config import settings

    app_url = (settings.next_public_app_url or "http://localhost:3002").rstrip("/")

    result = await db.execute(
        select(Signature).where(Signature.visibility_change_token == token)
    )
    sig = result.scalar_one_or_none()
    if not sig or not sig.pending_visibility:
        return RedirectResponse(f"{app_url}/", status_code=302)

    campaign_result = await db.execute(
        select(Campaign).where(Campaign.id == sig.campaign_id)
    )
    campaign = campaign_result.scalar_one_or_none()
    slug = campaign.slug if campaign else ""

    now = datetime.now(tz.utc)
    exp = sig.visibility_change_expires_at
    if exp is not None and exp.tzinfo is None:
        exp = exp.replace(tzinfo=tz.utc)
    if exp is not None and now > exp:
        return RedirectResponse(f"{app_url}/c/{slug}?confirmada=expirada", status_code=302)

    sig.visibility = sig.pending_visibility
    # El nombre se conserva sin importar la visibilidad (ver signature_service.
    # create_signature); solo cambia la exposición según visibility/rol.
    sig.pending_visibility = None
    sig.visibility_change_token = None
    sig.visibility_change_expires_at = None
    await db.commit()

    return RedirectResponse(f"{app_url}/c/{slug}?confirmada=visibilidad", status_code=302)


def _ics_escape(text: str) -> str:
    return (text or "").replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")


@router.get("/calendar.ics")
async def event_calendar_ics(title: str, start: datetime, location: str = "", details: str = ""):
    """Genera un .ics on-demand a partir de los datos ya incluidos en el link
    (no persiste nada) — usado por el botón 'Apple Calendar' de la invitación
    al evento de entrega. Duración fija de 2h."""
    start_utc = start if start.tzinfo else start.replace(tzinfo=timezone.utc)
    start_utc = start_utc.astimezone(timezone.utc)
    end_utc = start_utc + timedelta(hours=2)
    now_utc = datetime.now(timezone.utc)
    fmt = "%Y%m%dT%H%M%SZ"
    ics = "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Cauce//Evento//ES",
        "BEGIN:VEVENT",
        f"UID:{uuid.uuid4()}@cauce",
        f"DTSTAMP:{now_utc.strftime(fmt)}",
        f"DTSTART:{start_utc.strftime(fmt)}",
        f"DTEND:{end_utc.strftime(fmt)}",
        f"SUMMARY:{_ics_escape(title)}",
        f"LOCATION:{_ics_escape(location)}",
        f"DESCRIPTION:{_ics_escape(details)}",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ])
    return Response(
        content=ics,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="evento.ics"'},
    )


@router.get("/{campaign_id}")
async def get_campaign_public(campaign_id: str, db: AsyncSession = Depends(get_db)):
    campaign = await _get_active_campaign(db, campaign_id)
    org_result = await db.execute(select(Organization).where(Organization.id == campaign.org_id))
    org = org_result.scalar_one_or_none()
    count = await get_signature_count(db, campaign.id)
    total = await get_total_signature_count(db, campaign.id)
    return _serialize(campaign, org, count, total)
