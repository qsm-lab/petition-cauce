import uuid

from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CommsUpload(Base):
    """Imagen subida desde el editor del centro de comunicaciones
    (centro-comunicaciones, Fase 2). Registro de auditoría del archivo — el
    binario vive en el volumen del VPS (`settings.uploads_dir`), no en DB."""

    __tablename__ = "comms_upload"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    # Ruta relativa a settings.uploads_dir: "<org_id>/<campaign_id>/<uuid>.<ext>"
    path: Mapped[str] = mapped_column(Text, nullable=False)
    mime: Mapped[str] = mapped_column(String(50), nullable=False)
    bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
