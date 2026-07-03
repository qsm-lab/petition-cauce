import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db_with_org, get_current_user
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.services.category_service import CategoryService
from app.models.user import User

router = APIRouter()


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    return await CategoryService.list_categories(db, current_user.org_id)


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    try:
        return await CategoryService.create_category(db, data, current_user.org_id)
    except Exception as e:
        if "uq_categories_slug_org" in str(e):
            raise HTTPException(status_code=409, detail="Slug de categoría ya existe")
        raise


@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    cat = await CategoryService.update_category(db, category_id, data, current_user.org_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return cat


@router.patch("/categories/{category_id}/archive")
async def archive_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    cat = await CategoryService.archive_category(db, category_id, current_user.org_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return {"ok": True}


@router.get("/categories/{category_id}/campaigns")
async def get_category_campaigns(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_with_org),
):
    from sqlalchemy import select
    from app.models.campaign import Campaign
    from app.models.category import Category
    cat = await db.execute(select(Category).where(Category.id == category_id, Category.org_id == current_user.org_id))
    cat = cat.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    result = await db.execute(
        select(Campaign.id, Campaign.title, Campaign.status, Campaign.slug)
        .where(Campaign.category == cat.slug, Campaign.org_id == current_user.org_id, Campaign.archived_at.is_(None))
        .order_by(Campaign.created_at.desc())
    )
    return [{"id": str(r.id), "title": r.title, "status": r.status, "slug": r.slug} for r in result]
