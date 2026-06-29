from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.limiter import limiter
from app.schemas.response import RespondRequest, TrackRequest
from app.services.campaign_service import CampaignService
from app.services.response_service import ResponseService
from app.services.turnstile_service import verify_turnstile
from app.services.dedup_service import DedupService, DUPLICATE

router = APIRouter()


async def _resolve_slug(db: AsyncSession, slug: str):
    """Resuelve slug buscando primero en campaign.slug, luego en form.slug."""
    campaign = await CampaignService.get_campaign_by_slug(db, slug)
    if campaign:
        return campaign, None
    campaign, form = await CampaignService.get_campaign_by_form_slug(db, slug)
    return campaign, form


@router.get("/c/{slug}")
async def get_campaign_public(slug: str, db: AsyncSession = Depends(get_db)):
    campaign, form = await _resolve_slug(db, slug)
    if not campaign:
        raise HTTPException(status_code=404, detail="Formulario no encontrado")
    if campaign.status in ("archived",):
        raise HTTPException(status_code=404, detail="Formulario no encontrado")
    return await CampaignService.get_campaign_full(db, campaign, form)


@router.post("/c/{slug}/respond")
@limiter.limit("5/minute")
async def respond(slug: str, request: Request, data: RespondRequest, db: AsyncSession = Depends(get_db)):
    campaign, _ = await _resolve_slug(db, slug)
    if not campaign or campaign.status not in ("active", "online"):
        raise HTTPException(status_code=404, detail="Formulario no disponible")

    turnstile_ok = await verify_turnstile(data.turnstile_token)
    if not turnstile_ok:
        raise HTTPException(status_code=400, detail="Verificación anti-bot fallida")

    ip = request.headers.get("X-Forwarded-For", request.client.host)

    # En modo "online" se aplica anti-duplicado; en "active" (pruebas) se omite
    if campaign.status == "online":
        dedup_result = await DedupService.check(db, campaign, data.session_token, data.device_fingerprint, ip)
        if dedup_result == DUPLICATE:
            raise HTTPException(status_code=409, detail="Ya registraste una respuesta para este formulario")

    response = await ResponseService.save_response(db, campaign, data, ip)
    return {"ok": True, "response_id": str(response.id)}


@router.post("/c/{slug}/track")
async def track(slug: str, data: TrackRequest, db: AsyncSession = Depends(get_db)):
    campaign, _ = await _resolve_slug(db, slug)
    if campaign:
        await ResponseService.track_event(db, campaign, data)
    return {"ok": True}


@router.post("/verify-turnstile")
async def verify_turnstile_endpoint(request: Request):
    body = await request.json()
    token = body.get("token", "")
    ok = await verify_turnstile(token)
    return {"valid": ok}
