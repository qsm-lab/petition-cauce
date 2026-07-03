import uuid
from sqlalchemy import String, Text, SmallInteger, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class PrivacyPolicy(Base):
    __tablename__ = "privacy_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    aviso_firmante: Mapped[str] = mapped_column(Text, nullable=False, default="")
    aviso_organizacion: Mapped[str] = mapped_column(Text, nullable=False, default="")
    version: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    base_legal: Mapped[str] = mapped_column(String(100), nullable=False, default="consentimiento_expreso")
    data_contact_email: Mapped[str | None] = mapped_column(String(255))
    archived_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
