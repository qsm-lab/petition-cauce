import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.crypto import PIIDecryptError, compute_hmac, decrypt_pii
from app.dependencies import get_db_with_org, get_current_user
from app.limiter import limiter
from app.models.organization import Organization
from app.models.signature import Signature
from app.models.user import User
from app.models.campaign import Campaign
from app.services.admin_signature_service import AdminSignatureService
from app.services.auth_service import verify_password
from app.services.email_service import (
    send_confirmation_email,
    send_export_absoluto_notification,
    send_visibility_change_email,
)
from app.services.signature_service import _TOKEN_TTL_HOURS, build_privacy_url

from app.services.campaign_service import CampaignService

router = APIRouter()

_VISIBILITIES = {"publica", "anonima", "secreta"}


class VisibilityChangeRequest(BaseModel):
    visibility: str


class ExportAbsolutoRequest(BaseModel):
    password: str


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
        role=current_user.role,
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
        role=current_user.role,
        provincia=provincia,
        visibility=visibility,
        status=status,
    )


@router.post("/campaigns/{campaign_id}/signatures/export-absoluto")
@limiter.limit("5/minute")
async def export_signatures_absoluto(
    request: Request,
    campaign_id: str,
    data: ExportAbsolutoRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    """Descarga con PII sin enmascarar para el documento de entrega oficial.

    Re-valida la contraseña del admin autenticado (no un segundo secreto).
    Excluye siempre las firmas `secreta` (promesa hecha al firmante en el
    formulario). Notifica por email al contacto de la org y a la plataforma
    apenas se completa, con export_id/fecha/filas para trazabilidad.
    """
    if current_user.role not in ("admin", "gestor"):
        raise HTTPException(status_code=403, detail="Acceso denegado")
    if not verify_password(data.password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    campaign = await _get_campaign(campaign_id, _org_scope(current_user), db)
    org_id = campaign.org_id
    ip = request.headers.get("X-Real-IP") or (request.client.host if request.client else "")

    response, row_count, secret_excluded_count = await AdminSignatureService.export_absoluto(
        db,
        campaign_id=campaign.id,
        org_id=org_id,
        slug=campaign.slug,
        user_id=current_user.id,
        admin_email=current_user.email,
        ip_hmac=compute_hmac(ip),
    )

    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_result.scalar_one_or_none()
    await send_export_absoluto_notification(
        org_contact_email=(org.contact_email if org else None),
        campaign_title=campaign.title,
        admin_email=current_user.email,
        row_count=row_count,
        secret_excluded_count=secret_excluded_count,
        created_at=datetime.now(timezone.utc),
    )
    return response


@router.post("/campaigns/{campaign_id}/signatures/remind-pending")
@limiter.limit("3/minute")
async def remind_pending_signatures(
    request: Request,
    campaign_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    """Reenvía el email de confirmación a firmas públicas aún pendientes.

    Regenera el token de confirmación (el original ya expiró hace tiempo
    para firmas viejas) y lo reenvía. Solo `visibility='publica'` — ya
    tienen el nombre completo, no requieren el flujo de completar-nombre.

    PENDIENTE (pedido explícito del usuario, no implementado aún): sumar
    también a firmas 'anonima'/'secreta' pending_confirmation — hoy quedan
    fuera de este recordatorio porque no requieren nombre, pero igual deben
    poder confirmarse. Requiere copy de email distinto (sin la mención al
    nombre) antes de sumarlas acá.
    """
    if current_user.role not in ("admin", "gestor"):
        raise HTTPException(status_code=403, detail="Acceso denegado")

    campaign = await _get_campaign(campaign_id, _org_scope(current_user), db)
    org_result = await db.execute(select(Organization).where(Organization.id == campaign.org_id))
    org = org_result.scalar_one_or_none()

    result = await db.execute(
        select(Signature).where(
            Signature.campaign_id == campaign.id,
            Signature.status == "pending_confirmation",
            Signature.visibility == "publica",
        )
    )
    pending = result.scalars().all()

    sent = 0
    for sig in pending:
        try:
            email = decrypt_pii(sig.email_encrypted, ref=str(sig.id))
        except PIIDecryptError:
            continue

        sig.confirmation_token = uuid.uuid4().hex
        sig.confirmation_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_TTL_HOURS)
        await db.commit()

        await send_confirmation_email(
            to_email=email,
            token=sig.confirmation_token,
            campaign_title=campaign.petition_title or campaign.title,
            signer_name=sig.name or "",
            org_name=org.name if org else "",
            org_logo_url=(org.logo_url or "") if org else "",
            visibility=sig.visibility,
            privacy_url=build_privacy_url(campaign.slug),
            org_contact_email=(org.contact_email or "") if org else "",
        )
        sent += 1

    return {"ok": True, "sent": sent, "total_pending": len(pending)}


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
