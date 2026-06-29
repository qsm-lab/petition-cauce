import hashlib
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.campaign import Campaign
from app.models.response import Response

ALLOWED = "allowed"
TESTING_MODE = "testing_mode"
DUPLICATE = "duplicate"


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class DedupService:
    @staticmethod
    async def check(
        db: AsyncSession,
        campaign: Campaign,
        session_token: str,
        device_fingerprint: str | None,
        raw_ip: str,
    ) -> str:
        if campaign.status == "testing":
            return TESTING_MODE

        # Capa 1: session_token único
        result = await db.execute(
            select(Response).where(
                Response.session_token == session_token,
                Response.status == "completed",
            ).limit(1)
        )
        if result.scalars().first():
            return DUPLICATE

        # Capa 2: device_fingerprint + campaign
        if device_fingerprint:
            result = await db.execute(
                select(Response).where(
                    Response.campaign_id == campaign.id,
                    Response.device_fingerprint == device_fingerprint,
                    Response.status == "completed",
                ).limit(1)
            )
            if result.scalars().first():
                return DUPLICATE

        return ALLOWED
