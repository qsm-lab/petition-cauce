import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SendLog(Base):
    """Historial de auditoría de envíos del centro de comunicaciones (R14) —
    metadatos únicamente, **nunca** HTML/contenido (minimización LOPDP). Cubre
    tanto envíos inmediatos (`trigger=manual`) como disparados por la cola
    (`trigger=scheduled`); `mode` distingue prueba de real."""

    __tablename__ = "send_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    scheduled_send_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scheduled_send.id"), nullable=True
    )

    type: Mapped[str] = mapped_column(String(30), nullable=False)
    comms_class: Mapped[str] = mapped_column("class", String(20), nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False, default="")

    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    mode: Mapped[str] = mapped_column(String(10), nullable=False, default="real")  # real | test
    trigger: Mapped[str] = mapped_column(String(10), nullable=False, default="manual")  # manual | scheduled
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
