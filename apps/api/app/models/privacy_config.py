import uuid
from sqlalchemy import String, Text, Integer, SmallInteger, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class PrivacyConfig(Base):
    __tablename__ = "privacy_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"),
                                                    nullable=False, unique=True)
    aviso_privacidad: Mapped[str] = mapped_column(Text, nullable=False)
    base_legal: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    retention_days: Mapped[int] = mapped_column(Integer, nullable=False, default=365)
    data_contact_name: Mapped[str | None] = mapped_column(String(255))
    data_contact_email: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    campaign = relationship("Campaign", back_populates="privacy_config", uselist=False)
