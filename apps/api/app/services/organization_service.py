import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.organization import Organization
from app.models.campaign import Campaign
from app.schemas.organization import OrganizationCreate, OrganizationUpdate


class OrganizationService:

    @staticmethod
    async def list_organizations(db: AsyncSession) -> list[dict]:
        orgs_result = await db.execute(
            select(Organization).order_by(Organization.name)
        )
        orgs = list(orgs_result.scalars().all())

        # Campaña activas por org
        counts_result = await db.execute(
            select(Campaign.org_id, func.count().label("n"))
            .where(Campaign.status.in_(["active", "online"]))
            .where(Campaign.archived_at.is_(None))
            .group_by(Campaign.org_id)
        )
        counts = {row.org_id: row.n for row in counts_result}

        return [{"org": o, "active_campaigns": counts.get(o.id, 0)} for o in orgs]

    @staticmethod
    async def get_organization(db: AsyncSession, org_id: uuid.UUID) -> Organization | None:
        result = await db.execute(select(Organization).where(Organization.id == org_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create_organization(db: AsyncSession, data: OrganizationCreate) -> Organization:
        org = Organization(
            name=data.name,
            slug=data.slug,
            domain=data.domain,
            description=data.description,
            logo_url=data.logo_url,
            contact_email=data.contact_email,
            domains=data.domains,
            rep_name=data.rep_name,
            status=data.status,
        )
        db.add(org)
        await db.commit()
        await db.refresh(org)
        return org

    @staticmethod
    async def update_organization(
        db: AsyncSession, org_id: uuid.UUID, data: OrganizationUpdate
    ) -> Organization | None:
        org = await OrganizationService.get_organization(db, org_id)
        if not org:
            return None
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(org, k, v)
        await db.commit()
        await db.refresh(org)
        return org

    @staticmethod
    async def archive_organization(db: AsyncSession, org_id: uuid.UUID) -> Organization | None:
        org = await OrganizationService.get_organization(db, org_id)
        if not org:
            return None
        # No archivar si tiene campañas activas
        count_result = await db.execute(
            select(func.count()).where(
                Campaign.org_id == org_id,
                Campaign.status.in_(["active", "online"]),
                Campaign.archived_at.is_(None),
            )
        )
        if (count_result.scalar() or 0) > 0:
            raise ValueError("org_con_campanas_activas")
        org.archived_at = datetime.now(timezone.utc)
        await db.commit()
        return org
