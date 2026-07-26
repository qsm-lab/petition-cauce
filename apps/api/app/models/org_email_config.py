import uuid

from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class OrgEmailConfig(Base):
    """Configuración de proveedor de email por organización (config-email-org).

    Una config activa por org (unique org_id en MVP). Las credenciales van
    cifradas en reposo (`credentials_encrypted`, formato sec:v1:) con clave
    dedicada — nunca en claro, nunca devueltas al frontend.
    """

    __tablename__ = "org_email_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False, default="resend")
    # JSON cifrado con lo que el proveedor necesita: {"api_key": ...} (resend) o
    # {"host","port","user","pass","tls"} (smtp). sec:v1:...
    credentials_encrypted: Mapped[str | None] = mapped_column(Text)
    plan: Mapped[str | None] = mapped_column(String(20))  # free | pro | null (informativo)
    daily_quota: Mapped[int | None] = mapped_column(Integer)
    monthly_quota: Mapped[int | None] = mapped_column(Integer)
    default_from: Mapped[str | None] = mapped_column(String(255))
    default_reply_to: Mapped[str | None] = mapped_column(String(255))
    default_display_name: Mapped[str | None] = mapped_column(String(255))
    allowed_domains: Mapped[list] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # active | disabled
    verified_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
