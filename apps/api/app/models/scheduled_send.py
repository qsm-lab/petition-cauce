import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, event, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ScheduledSend(Base):
    """Envío del centro de comunicaciones en curso de armado, programado o en
    cola (centro-comunicaciones, Fase 3). `status=draft` + `scheduled_at=None`
    es un borrador (R22); `status=pending` con `scheduled_at` en el futuro es
    un envío programado (R12); al vencer, el loop lo expande en `send_batch` y
    lo pasa a `sending` hasta agotar los lotes (R13)."""

    __tablename__ = "scheduled_send"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)

    type: Mapped[str] = mapped_column(String(30), nullable=False)
    comms_class: Mapped[str] = mapped_column("class", String(20), nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Título (H1) mostrado dentro del cuerpo del email — editable por el
    # admin, ya no fijo por tipo (antes _COMMS_HEADING hardcodeado).
    heading: Mapped[str] = mapped_column(Text, nullable=False, default="")
    body_html: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ctas: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    include_social: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    audience: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    scheduled_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # draft | pending | sending | sent | cancelled | failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")

    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


@event.listens_for(ScheduledSend, "before_update")
def _set_updated_at(mapper, connection, target: ScheduledSend) -> None:
    # Seteado en Python (no `onupdate=func.now()` server-side): un valor
    # generado por el servidor en un UPDATE queda "expired" y el próximo
    # acceso sincrónico al atributo (p. ej. serializando la respuesta HTTP)
    # dispara un lazy-load fuera del greenlet async — MissingGreenlet. Visto
    # en la verificación real de esta sesión al programar un envío.
    target.updated_at = datetime.now(timezone.utc)
