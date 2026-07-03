import uuid
import re
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


def _to_slug(name: str) -> str:
    s = name.lower().strip()
    for src, dst in [("áàäâ","a"),("éèëê","e"),("íìïî","i"),("óòöô","o"),("úùüû","u"),("ñ","n")]:
        for c in src:
            s = s.replace(c, dst)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:60]


class CategoryService:

    @staticmethod
    async def list_categories(db: AsyncSession, org_id: uuid.UUID) -> list[Category]:
        result = await db.execute(
            select(Category)
            .where(Category.org_id == org_id, Category.archived_at.is_(None))
            .order_by(Category.name)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_category(db: AsyncSession, category_id: uuid.UUID, org_id: uuid.UUID) -> Category | None:
        result = await db.execute(
            select(Category).where(Category.id == category_id, Category.org_id == org_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_category(db: AsyncSession, data: CategoryCreate, org_id: uuid.UUID) -> Category:
        cat = Category(
            org_id=org_id,
            name=data.name,
            slug=data.slug or _to_slug(data.name),
            color=data.color,
        )
        db.add(cat)
        await db.commit()
        await db.refresh(cat)
        return cat

    @staticmethod
    async def update_category(
        db: AsyncSession, category_id: uuid.UUID, data: CategoryUpdate, org_id: uuid.UUID
    ) -> Category | None:
        cat = await CategoryService.get_category(db, category_id, org_id)
        if not cat:
            return None
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(cat, k, v)
        await db.commit()
        await db.refresh(cat)
        return cat

    @staticmethod
    async def archive_category(
        db: AsyncSession, category_id: uuid.UUID, org_id: uuid.UUID
    ) -> Category | None:
        cat = await CategoryService.get_category(db, category_id, org_id)
        if not cat:
            return None
        cat.archived_at = datetime.now(timezone.utc)
        await db.commit()
        return cat
