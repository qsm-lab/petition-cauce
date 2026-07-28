import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SendBatch(Base):
    """Lote de destinatarios de un `scheduled_send`, trozado por cuota diaria
    del proveedor (R13, D4). `signature_ids` referencia filas de `signatures`
    (no duplica PII); el loop descifra el email recién al procesar el lote.
    `org_id` denormalizado desde `scheduled_send` para una política RLS simple
    (mismo patrón NULLIF que el resto de tablas), sin requerir join."""

    __tablename__ = "send_batch"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scheduled_send_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scheduled_send.id"), nullable=False
    )
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    batch_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    signature_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # pending | sending | sent | failed | cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    sent_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
