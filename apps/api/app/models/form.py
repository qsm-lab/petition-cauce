import uuid
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Form(Base):
    __tablename__ = "forms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True, index=True)
    slug: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    privacy_notice_text: Mapped[str | None] = mapped_column(Text)
    requires_explicit_consent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    consent_text: Mapped[str | None] = mapped_column(Text)
    consent_version: Mapped[str | None] = mapped_column(String(20), default="1.0")
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def cover_image_url(self) -> str | None:
        return (self.meta or {}).get("cover_image_url")

    @property
    def description_font_size(self) -> int | None:
        val = (self.meta or {}).get("description_font_size")
        return int(val) if val is not None else None

    @property
    def og_description(self) -> str | None:
        return (self.meta or {}).get("og_description")

    @property
    def og_image_alt(self) -> str | None:
        return (self.meta or {}).get("og_image_alt")

    organization = relationship("Organization", back_populates="forms")
    creator = relationship("User", back_populates="forms")
    campaign = relationship("Campaign", foreign_keys="Form.campaign_id", back_populates="forms")
    questions = relationship("Question", back_populates="form", cascade="all, delete-orphan", order_by="Question.order_index")
    campaigns = relationship("Campaign", foreign_keys="Campaign.form_id", back_populates="form", viewonly=True)
    versions = relationship("FormVersion", back_populates="form", cascade="all, delete-orphan", order_by="FormVersion.version_number.desc()")
