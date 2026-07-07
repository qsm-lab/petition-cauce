import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.crypto import PIIDecryptError, decrypt_pii
from app.dependencies import get_db_with_org, get_current_user
from app.models.organization import Organization
from app.models.signature import Signature
from app.models.user import User
from app.models.campaign import Campaign
from app.services.admin_signature_service import AdminSignatureService
from app.services.email_service import send_visibility_change_email

from app.services.campaign_service import CampaignService

router = APIRouter()

_VISIBILITIES = {"publica", "anonima", "secreta"}


class VisibilityChangeRequest(BaseModel):
    visibility: str


def _org_scope(user: User) -> uuid.UUID | None:
    """None para admin de plataforma (multi-org); org propia para otros roles."""
    return None if user.role == "admin" else user.org_id


@router.get("/campaigns")
async def list_campaigns_with_counts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    if current_user.role not in ("admin", "gestor"):
        raise HTTPException(status_code=403, detail="Acceso denegado")
    return await CampaignService.list_with_counts(db, _org_scope(current_user))


async def _get_campaign(campaign_id: str, org_id: uuid.UUID | None, db: AsyncSession) -> Campaign:
    stmt = select(Campaign).where(Campaign.id == campaign_id)
    if org_id is not None:
        stmt = stmt.where(Campaign.org_id == org_id)
    result = await db.execute(stmt)
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
    campaign = await _get_campaign(campaign_id, _org_scope(current_user), db)
    return await AdminSignatureService.list_signatures(
        db,
        campaign_id=campaign.id,
        org_id=_org_scope(current_user),
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
    campaign = await _get_campaign(campaign_id, _org_scope(current_user), db)
    return await AdminSignatureService.export_csv(
        db,
        campaign_id=campaign.id,
        org_id=_org_scope(current_user),
        slug=campaign.slug,
        provincia=provincia,
        visibility=visibility,
        status=status,
    )


@router.patch("/campaigns/{campaign_id}/signatures/{signature_id}/visibility")
async def request_visibility_change(
    campaign_id: str,
    signature_id: str,
    data: VisibilityChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    """Solicita el cambio de visibilidad de una firma (pedido verbal del titular).

    No aplica el cambio: envía un email al firmante con un enlace de
    confirmación (24 h). El cambio se aplica en confirm-visibility.
    """
    if current_user.role not in ("admin", "gestor"):
        raise HTTPException(status_code=403, detail="Acceso denegado")
    if data.visibility not in _VISIBILITIES:
        raise HTTPException(status_code=422, detail="Visibilidad inválida")

    campaign = await _get_campaign(campaign_id, _org_scope(current_user), db)

    result = await db.execute(
        select(Signature).where(
            Signature.id == signature_id,
            Signature.campaign_id == campaign.id,
        )
    )
    sig = result.scalar_one_or_none()
    if not sig:
        raise HTTPException(status_code=404, detail="Firma no encontrada")
    if sig.status != "confirmed":
        raise HTTPException(status_code=409, detail="Solo se puede cambiar la visibilidad de firmas confirmadas")
    if data.visibility == sig.visibility:
        raise HTTPException(status_code=409, detail="La firma ya tiene esa visibilidad")
    if data.visibility == "publica" and not sig.name:
        raise HTTPException(
            status_code=409,
            detail="No se puede pasar a pública: el nombre no fue almacenado (firma anónima/secreta). El titular debe volver a firmar.",
        )

    try:
        email = decrypt_pii(sig.email_encrypted, ref=str(sig.id))
    except PIIDecryptError:
        raise HTTPException(status_code=500, detail="No se pudo recuperar el email del firmante")

    sig.pending_visibility = data.visibility
    sig.visibility_change_token = uuid.uuid4().hex
    sig.visibility_change_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.commit()
    await db.refresh(sig)

    org_result = await db.execute(select(Organization).where(Organization.id == campaign.org_id))
    org = org_result.scalar_one_or_none()
    await send_visibility_change_email(
        to_email=email,
        token=sig.visibility_change_token,
        campaign_title=campaign.petition_title or campaign.title,
        new_visibility=data.visibility,
        signer_name=sig.name or "",
        org_name=org.name if org else "",
        org_logo_url=(org.logo_url or "") if org else "",
    )
    return {"ok": True, "pending_visibility": sig.pending_visibility}
