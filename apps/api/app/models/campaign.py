import uuid
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    form_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("forms.id"), nullable=True, index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    access_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="public")
    starts_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    max_responses: Mapped[int | None] = mapped_column(Integer)
    source_platform: Mapped[str | None] = mapped_column(String(50))
    qr_code_data: Mapped[str | None] = mapped_column(Text)
    quota_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def social_links(self) -> dict:
        if self.meta and isinstance(self.meta, dict):
            return self.meta.get("social_links", {})
        return {}

    @property
    def thank_you_title(self) -> str | None:
        if self.meta and isinstance(self.meta, dict):
            return self.meta.get("thank_you_title")
        return None

    @property
    def thank_you_body(self) -> str | None:
        if self.meta and isinstance(self.meta, dict):
            return self.meta.get("thank_you_body")
        return None

    @property
    def description(self) -> str | None:
        return (self.meta or {}).get("description")

    @property
    def data_protection_level(self) -> str | None:
        return (self.meta or {}).get("data_protection_level")

    @property
    def share_text(self) -> str | None:
        if self.meta and isinstance(self.meta, dict):
            return self.meta.get("share_text")
        return None

    @property
    def welcome_logo_url(self) -> str | None:
        return (self.meta or {}).get("welcome_logo_url")

    @property
    def welcome_title(self) -> str | None:
        return (self.meta or {}).get("welcome_title")

    @property
    def welcome_title_size(self) -> str | None:
        return (self.meta or {}).get("welcome_title_size", "3xl")

    @property
    def welcome_description(self) -> str | None:
        return (self.meta or {}).get("welcome_description")

    @property
    def welcome_slogan(self) -> str | None:
        return (self.meta or {}).get("welcome_slogan")

    @property
    def welcome_slogan_size(self) -> str | None:
        return (self.meta or {}).get("welcome_slogan_size", "2xl")

    @property
    def welcome_title_color(self) -> str:
        return (self.meta or {}).get("welcome_title_color", "#FFFFFF")

    @property
    def welcome_slogan_color(self) -> str:
        return (self.meta or {}).get("welcome_slogan_color", "#FFFFFF")

    form = relationship("Form", foreign_keys="Campaign.form_id", back_populates="campaigns", viewonly=True)
    forms = relationship("Form", foreign_keys="Form.campaign_id", back_populates="campaign")
    creator = relationship("User", back_populates="campaigns")
    responses = relationship("Response", back_populates="campaign")
    allowlist = relationship("CampaignAllowlist", back_populates="campaign", cascade="all, delete-orphan")


class CampaignAllowlist(Base):
    __tablename__ = "campaign_allowlist"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    used_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("Campaign", back_populates="allowlist")
