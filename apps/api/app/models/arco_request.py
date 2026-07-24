import uuid
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class ArcoRequest(Base):
    """Evidencia de cumplimiento LOPDP para derechos ARCO — sin PII (solo email_hash)."""

    __tablename__ = "arco_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    # Poblada por trigger BEFORE INSERT (migración 035) desde campaigns.org_id — no se setea desde la aplicación.
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    right_type: Mapped[str] = mapped_column(String(20), nullable=False)
    email_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    requested_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    result: Mapped[str | None] = mapped_column(String(20))
    detail: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
