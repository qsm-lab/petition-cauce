import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db_with_org, get_current_user
from app.limiter import limiter
from app.schemas.organization import OrganizationCreate, OrganizationUpdate, OrganizationResponse
from app.schemas.org_email_config import (
    OrgEmailConfigResponse,
    OrgEmailConfigUpdate,
    OrgEmailTestRequest,
)
from app.services.organization_service import OrganizationService
from app.services.org_email_config_service import OrgEmailConfigService, to_response
from app.models.user import User

router = APIRouter()


def _require_platform_admin(current_user: User) -> None:
    # En este sistema el rol 'admin' es el platform_admin (get_db_with_org le
    # setea is_platform_admin=true). Solo él gestiona la config de email (D5).
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado")


@router.get("/organizaciones", response_model=list[dict])
async def list_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado")
    rows = await OrganizationService.list_organizations(db)
    return [
        {**OrganizationResponse.model_validate(r["org"]).model_dump(), "active_campaigns": r["active_campaigns"]}
        for r in rows
    ]


@router.post("/organizaciones", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    data: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado")
    try:
        return await OrganizationService.create_organization(db, data)
    except Exception as e:
        if "unique" in str(e).lower() and "slug" in str(e).lower():
            raise HTTPException(status_code=409, detail="Slug de organización ya existe")
        raise


@router.get("/organizaciones/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    org = await OrganizationService.get_organization(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    return org


@router.patch("/organizaciones/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: uuid.UUID,
    data: OrganizationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado")
    org = await OrganizationService.update_organization(db, org_id, data)
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    return org


@router.patch("/organizaciones/{org_id}/archive")
async def archive_organization(
    org_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acceso denegado")
    try:
        org = await OrganizationService.archive_organization(db, org_id)
    except ValueError:
        raise HTTPException(status_code=409, detail="La organización tiene campañas activas")
    if not org:
        raise HTTPException(status_code=404, detail="Organización no encontrada")
    return {"ok": True}


@router.get("/organizaciones/{org_id}/campaigns")
async def get_org_campaigns(
    org_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    from sqlalchemy import select
    from app.models.campaign import Campaign
    result = await db.execute(
        select(Campaign.id, Campaign.title, Campaign.status, Campaign.slug)
        .where(Campaign.org_id == org_id, Campaign.archived_at.is_(None))
        .order_by(Campaign.created_at.desc())
    )
    return [{"id": str(r.id), "title": r.title, "status": r.status, "slug": r.slug} for r in result]


# ── Configuración de email por organización (config-email-org) ───────────────

@router.get("/organizaciones/{org_id}/email-config", response_model=OrgEmailConfigResponse)
async def get_org_email_config(
    org_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    _require_platform_admin(current_user)
    cfg = await OrgEmailConfigService.get(db, org_id)
    if cfg is None:
        raise HTTPException(status_code=404, detail="Sin configuración de email (usa la de plataforma)")
    return await to_response(cfg)


@router.put("/organizaciones/{org_id}/email-config", response_model=OrgEmailConfigResponse)
async def upsert_org_email_config(
    org_id: uuid.UUID,
    data: OrgEmailConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    _require_platform_admin(current_user)
    cfg = await OrgEmailConfigService.upsert(db, org_id, data, created_by=current_user.id)
    return await to_response(cfg)


@router.delete("/organizaciones/{org_id}/email-config", status_code=204)
async def delete_org_email_config(
    org_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    _require_platform_admin(current_user)
    await OrgEmailConfigService.delete(db, org_id)


@router.post("/organizaciones/{org_id}/email-config/test")
@limiter.limit("5/minute")
async def test_org_email_config(
    request: Request,
    org_id: uuid.UUID,
    data: OrgEmailTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    """R13: rate limit — el endpoint envía correo real con credenciales de
    terceros; sin límite sería un relay de spam trivial para quien tenga
    sesión de platform_admin (o la robe)."""
    _require_platform_admin(current_user)
    ok = await OrgEmailConfigService.send_test(db, org_id, data.to)
    if not ok:
        raise HTTPException(status_code=400, detail="No se pudo enviar la prueba — revisá la configuración")
    return {"ok": True}
