import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.privacy_policy import PrivacyPolicy
from app.schemas.privacy_policy import PrivacyPolicyCreate, PrivacyPolicyUpdate


class PrivacyPolicyService:

    @staticmethod
    async def list_policies(db: AsyncSession, org_id: uuid.UUID) -> list[PrivacyPolicy]:
        result = await db.execute(
            select(PrivacyPolicy)
            .where(PrivacyPolicy.org_id == org_id, PrivacyPolicy.archived_at.is_(None))
            .order_by(PrivacyPolicy.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_policy(db: AsyncSession, policy_id: uuid.UUID, org_id: uuid.UUID) -> PrivacyPolicy | None:
        result = await db.execute(
            select(PrivacyPolicy).where(PrivacyPolicy.id == policy_id, PrivacyPolicy.org_id == org_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_policy(db: AsyncSession, data: PrivacyPolicyCreate, org_id: uuid.UUID) -> PrivacyPolicy:
        policy = PrivacyPolicy(
            org_id=org_id,
            title=data.title,
            aviso_firmante=data.aviso_firmante,
            aviso_organizacion=data.aviso_organizacion,
            base_legal=data.base_legal,
            data_contact_email=data.data_contact_email,
        )
        db.add(policy)
        await db.commit()
        await db.refresh(policy)
        return policy

    @staticmethod
    async def update_policy(
        db: AsyncSession, policy_id: uuid.UUID, data: PrivacyPolicyUpdate, org_id: uuid.UUID
    ) -> PrivacyPolicy | None:
        policy = await PrivacyPolicyService.get_policy(db, policy_id, org_id)
        if not policy:
            return None
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(policy, k, v)
        policy.version += 1
        await db.commit()
        await db.refresh(policy)
        return policy

    @staticmethod
    async def archive_policy(
        db: AsyncSession, policy_id: uuid.UUID, org_id: uuid.UUID
    ) -> PrivacyPolicy | None:
        policy = await PrivacyPolicyService.get_policy(db, policy_id, org_id)
        if not policy:
            return None
        policy.archived_at = datetime.now(timezone.utc)
        await db.commit()
        return policy
