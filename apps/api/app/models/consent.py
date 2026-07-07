import uuid
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    signature_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("signatures.id"), nullable=False)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    text_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    legal_basis: Mapped[str] = mapped_column(String(100), nullable=False)
    consented_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ip_hmac: Mapped[str | None] = mapped_column(String(128))
    subscribe_newsletter: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notify_updates: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    signature = relationship("Signature", back_populates="consents")
    campaign = relationship("Campaign", back_populates="consents")
