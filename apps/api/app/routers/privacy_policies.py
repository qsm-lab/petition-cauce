import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db_with_org, get_current_user
from app.schemas.privacy_policy import PrivacyPolicyCreate, PrivacyPolicyUpdate, PrivacyPolicyResponse
from app.services.privacy_policy_service import PrivacyPolicyService
from app.models.user import User

router = APIRouter()


@router.get("/privacy-policies", response_model=list[PrivacyPolicyResponse])
async def list_policies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    return await PrivacyPolicyService.list_policies(db, current_user.org_id)


@router.post("/privacy-policies", response_model=PrivacyPolicyResponse, status_code=201)
async def create_policy(
    data: PrivacyPolicyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    return await PrivacyPolicyService.create_policy(db, data, current_user.org_id)


@router.get("/privacy-policies/{policy_id}", response_model=PrivacyPolicyResponse)
async def get_policy(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    policy = await PrivacyPolicyService.get_policy(db, policy_id, current_user.org_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Política no encontrada")
    return policy


@router.patch("/privacy-policies/{policy_id}", response_model=PrivacyPolicyResponse)
async def update_policy(
    policy_id: uuid.UUID,
    data: PrivacyPolicyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    policy = await PrivacyPolicyService.update_policy(db, policy_id, data, current_user.org_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Política no encontrada")
    return policy


@router.patch("/privacy-policies/{policy_id}/archive")
async def archive_policy(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    policy = await PrivacyPolicyService.archive_policy(db, policy_id, current_user.org_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Política no encontrada")
    return {"ok": True}


@router.get("/privacy-policies/{policy_id}/campaigns")
async def get_policy_campaigns(
    policy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    from sqlalchemy import select
    from app.models.campaign import Campaign
    from app.models.organization import Organization
    result = await db.execute(
        select(Campaign.id, Campaign.title, Campaign.status, Campaign.slug, Campaign.org_id)
        .where(Campaign.privacy_policy_id == policy_id, Campaign.archived_at.is_(None))
        .order_by(Campaign.created_at.desc())
    )
    rows = result.all()
    # Get org names
    org_ids = list({r.org_id for r in rows})
    orgs = {}
    if org_ids:
        org_result = await db.execute(select(Organization).where(Organization.id.in_(org_ids)))
        orgs = {o.id: o.name for o in org_result.scalars()}
    return [
        {"id": str(r.id), "title": r.title, "status": r.status, "slug": r.slug,
         "org_name": orgs.get(r.org_id, "")}
        for r in rows
    ]
