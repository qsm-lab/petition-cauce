import uuid
from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Signature(Base):
    __tablename__ = "signatures"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255))
    email_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    email_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    cedula_encrypted: Mapped[str | None] = mapped_column(Text)
    cedula_hash: Mapped[str | None] = mapped_column(String(128))
    provincia: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    signer_type: Mapped[str] = mapped_column(String(10), nullable=False, default="natural")
    org_name: Mapped[str | None] = mapped_column(String(500))
    org_name_hash: Mapped[str | None] = mapped_column(String(128))
    visibility: Mapped[str] = mapped_column(String(10), nullable=False, default="anonima")
    status: Mapped[str] = mapped_column(String(25), nullable=False, default="pending_confirmation")
    source: Mapped[str | None] = mapped_column(String(50))
    is_test: Mapped[bool] = mapped_column(default=False, nullable=False)
    confirmation_token: Mapped[str | None] = mapped_column(String(128), unique=True)
    confirmation_token_expires_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    confirmed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    ip_hmac: Mapped[str | None] = mapped_column(String(128))
    # Cambio de visibilidad iniciado por admin, pendiente de confirmación del titular
    pending_visibility: Mapped[str | None] = mapped_column(String(10))
    visibility_change_token: Mapped[str | None] = mapped_column(String(128))
    visibility_change_expires_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    anulada_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    anulada_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    campaign = relationship("Campaign", back_populates="signatures")
    organization = relationship("Organization", back_populates="signatures")
    consents = relationship("Consent", back_populates="signature", cascade="all, delete-orphan")
