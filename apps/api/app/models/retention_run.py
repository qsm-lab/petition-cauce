import uuid
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class RetentionRun(Base):
    __tablename__ = "retention_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    started_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    trigger: Mapped[str] = mapped_column(String(20), nullable=False)
    campaigns_evaluated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    signatures_anonymized: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    detail: Mapped[list] = mapped_column(JSONB, default=list)
