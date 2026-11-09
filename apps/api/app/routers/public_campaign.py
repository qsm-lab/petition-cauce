import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.client_ip import get_client_ip
from app.config import settings
from app.crypto import compute_hmac
from app.database import set_rls_context
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
from app.services.confirmation_email_service import attempt_send
from app.services.signature_service import (
    complete_signature_name,
    confirm_signature,
    create_signature,
    get_completion_context,
    get_recent_signatures,
    get_signature_count,
    get_total_signature_count,
    set_newsletter_consent,
    unsubscribe_by_token,
)
from app.services.public_cache import CacheBusy, get_or_build
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


# cache-lecturas-publicas: las tres lecturas de la landing salen de una copia corta en Redis (public_cache.py).
_PUBLIC_CACHE_CONTROL = "public, s-maxage=10, stale-while-revalidate=30"
_NO_STORE = {"Cache-Control": "no-store"}


def _not_found() -> HTTPException:
    # Los errores nunca se cachean en el borde (RK5)
    return HTTPException(status_code=404, detail="Campaña no encontrada", headers=_NO_STORE)


async def _cached(response: Response, key: str, builder):
    try:
        value, state = await get_or_build(key, builder)
    except CacheBusy:
        raise HTTPException(status_code=503, detail="Servicio saturado, reintenta", headers={"Retry-After": "1", **_NO_STORE})
    response.headers["Cache-Control"] = _PUBLIC_CACHE_CONTROL if settings.public_cache_enabled else "no-store"
    response.headers["X-Cache"] = state
    return value


async def _visible_index(db: AsyncSession) -> dict:
    """Slugs e ids de las campañas visibles. Responde los 404 sin consultar la base (slugs/ids inventados no agotan el pool)."""
    rows = (await db.execute(select(Campaign.slug, Campaign.id).where(Campaign.archived_at.is_(None)))).all()
    return {"slugs": {slug: str(cid) for slug, cid in rows}, "ids": sorted(str(cid) for _, cid in rows)}


async def _campaign_payload(db: AsyncSession, campaign_id: str) -> dict:
    campaign = await _get_active_campaign(db, campaign_id)
    org_result = await db.execute(select(Organization).where(Organization.id == campaign.org_id))
    org = org_result.scalar_one_or_none()
    count = await get_signature_count(db, campaign.id)
    total = await get_total_signature_count(db, campaign.id)
    return jsonable_encoder(_serialize(campaign, org, count, total))


async def _resolve_id(response: Response, db: AsyncSession, *, slug: str | None = None, campaign_id: str | None = None) -> str:
    index = await _cached(response, "index", lambda: _visible_index(db))
    if slug is not None:
        cid = index["slugs"].get(slug)
    else:
        try:
            cid = str(uuid.UUID(campaign_id))
        except ValueError:
            cid = None
        if cid not in index["ids"]:
            cid = None
    if not cid:
        raise _not_found()
    return cid


@router.get("/by-slug/{slug}")
async def get_by_slug(slug: str, response: Response, db: AsyncSession = Depends(get_db)):
    cid = await _resolve_id(response, db, slug=slug)
    return await _cached(response, f"campaign:{cid}", lambda: _campaign_payload(db, cid))


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
    response: Response,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    cid = await _resolve_id(response, db, campaign_id=campaign_id)
    limit = max(1, min(limit, 20))
    return await _cached(response, f"recent:{cid}:{limit}", lambda: get_recent_signatures(db, uuid.UUID(cid), limit))


# Espera máxima (s) del turno de velocidad para el intento inmediato; más allá, lo toma el loop.
_IMMEDIATE_SEND_MAX_WAIT = 0.5


@router.post("/{campaign_id}/signatures", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def submit_signature(
    campaign_id: str,
    request: Request,
    data: SignatureCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_signable_campaign(db, campaign_id)

    if not await verify_turnstile(data.cf_turnstile_token):
        raise HTTPException(status_code=422, detail={"error": "turnstile_failed"})

    ip = get_client_ip(request)
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

    # El correo de confirmación sale fuera de la petición. Si no hay turno de velocidad, el loop lo recupera.
    background_tasks.add_task(attempt_send, sig.id, max_wait=_IMMEDIATE_SEND_MAX_WAIT)

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
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    campaign = await _get_signable_campaign(db, campaign_id)
    email_normalized = data.email.strip().lower()
    email_hash = compute_hmac(email_normalized)

    result = await db.execute(
        select(Signature.id).where(
            Signature.campaign_id == campaign.id,
            Signature.email_hash == email_hash,
            Signature.status == "pending_confirmation",
        )
    )
    sig_id = result.scalar_one_or_none()

    # Always 204 — never reveal whether the email exists
    if sig_id:
        # Se re-encola el envío: el servicio renueva el token si caducó y respeta velocidad y reclamo.
        # Un envío ya en curso (`sending`) no se pisa.
        await set_rls_context(db, platform_admin=True)
        await db.execute(
            update(Signature)
            .where(Signature.id == sig_id, Signature.confirmation_email_status != "sending")
            .values(
                confirmation_email_status="pending",
                confirmation_email_attempts=0,
                confirmation_email_next_at=func.now(),
            )
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        background_tasks.add_task(attempt_send, sig_id, max_wait=_IMMEDIATE_SEND_MAX_WAIT)

    return Response(status_code=204)


@router.get("/confirm/{token}")
async def confirm_sig(token: str):
    """Redirige a la página de confirmación SIN confirmar (verificacion-confirmacion-privacidad, D1=A).

    Los escáneres de enlaces del correo hacen GET sobre cada URL; confirmar aquí daría por verificado un
    consentimiento que ninguna persona dio. La confirmación real es el POST de la página. Se conserva la
    ruta para que los correos ya enviados sigan funcionando.
    """
    from fastapi.responses import RedirectResponse
    from app.config import settings
    from urllib.parse import quote

    app_url = (settings.next_public_app_url or "http://localhost:3002").rstrip("/")
    return RedirectResponse(f"{app_url}/confirmar/{quote(token, safe='')}", status_code=302)


@router.post("/confirm/{token}")
@limiter.limit("20/minute")
async def confirm_sig_post(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Confirma la firma cuando la persona pulsa el botón de la página. Idempotente.

    Respuesta genérica: un token desconocido devuelve `invalid` con 200 (no revela si existe).
    """
    result = await confirm_signature(db, token)
    if not result or not result.get("slug"):
        return {"status": "invalid"}
    out = {"status": result["status"], "slug": result["slug"]}
    # El nombre acaba en la URL de la landing (?nombre=): solo si la persona eligió firmar de forma pública.
    if result["status"] == "confirmed" and result.get("name") and result.get("visibility") == "publica":
        out["name"] = result["name"]
    return out


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


@router.get("/signatures/{signature_id}/unsubscribe")
@limiter.limit("10/minute")
async def unsubscribe_signature(
    signature_id: uuid.UUID, token: str, request: Request, db: AsyncSession = Depends(get_db),
):
    """R20: desuscripción de un clic desde el footer de la clase Anuncios —
    sin autenticación (estándar de la industria), token HMAC verificado
    server-side. Setea `Consent.notify_updates = False`; redirige a la
    landing de la campaña con un aviso, igual que confirm-visibility."""
    from fastapi.responses import RedirectResponse
    from app.config import settings

    app_url = (settings.next_public_app_url or "http://localhost:3002").rstrip("/")

    result = await db.execute(select(Signature).where(Signature.id == signature_id))
    sig = result.scalar_one_or_none()
    slug = ""
    if sig:
        campaign_result = await db.execute(select(Campaign).where(Campaign.id == sig.campaign_id))
        campaign = campaign_result.scalar_one_or_none()
        slug = campaign.slug if campaign else ""

    ok = await unsubscribe_by_token(db, signature_id, token)
    if not ok:
        return RedirectResponse(f"{app_url}/c/{slug}?desuscripcion=invalida", status_code=302)
    return RedirectResponse(f"{app_url}/c/{slug}?desuscripcion=ok", status_code=302)


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
async def get_campaign_public(campaign_id: str, response: Response, db: AsyncSession = Depends(get_db)):
    cid = await _resolve_id(response, db, campaign_id=campaign_id)
    return await _cached(response, f"campaign:{cid}", lambda: _campaign_payload(db, cid))
