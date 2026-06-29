import uuid
from sqlalchemy import String, Text, Integer, Numeric, Boolean, DateTime, ForeignKey, func, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Response(Base):
    __tablename__ = "responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="started")
    session_token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    device_fingerprint: Mapped[str | None] = mapped_column(String(128))
    ip_hash: Mapped[str | None] = mapped_column(String(128))
    platform_source: Mapped[str | None] = mapped_column(String(50))
    current_question_idx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    completion_pct: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    started_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    time_spent_seconds: Mapped[int | None] = mapped_column(Integer)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)

    campaign = relationship("Campaign", back_populates="responses")
    answers = relationship("ResponseAnswer", back_populates="response", cascade="all, delete-orphan")
    consent = relationship("PrivacyConsent", back_populates="response")


class ResponseAnswer(Base):
    __tablename__ = "response_answers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    response_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("responses.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False, index=True)
    question_code: Mapped[str] = mapped_column(String(50), nullable=False)
    question_type: Mapped[str] = mapped_column(String(50), nullable=False)
    value_text: Mapped[str | None] = mapped_column(Text)
    value_number: Mapped[float | None] = mapped_column(Numeric)
    value_choice: Mapped[str | None] = mapped_column(String(255))
    value_choices: Mapped[list | None] = mapped_column(ARRAY(Text))
    value_matrix: Mapped[dict | None] = mapped_column(JSONB)
    answered_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    time_on_question_seconds: Mapped[int | None] = mapped_column(Integer)

    response = relationship("Response", back_populates="answers")
    question = relationship("Question")


class PrivacyConsent(Base):
    __tablename__ = "privacy_consents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False, index=True)
    response_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("responses.id", ondelete="SET NULL"))
    consent_text_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    consent_version: Mapped[str] = mapped_column(String(20), nullable=False)
    ip_hash: Mapped[str | None] = mapped_column(String(128))
    device_fingerprint: Mapped[str | None] = mapped_column(String(128))
    consented_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    response = relationship("Response", back_populates="consent")


class ExportLog(Base):
    __tablename__ = "exports_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    format: Mapped[str] = mapped_column(String(20), nullable=False)
    anonymized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    filters_applied: Mapped[dict] = mapped_column(JSONB, default=dict)
    row_count: Mapped[int | None] = mapped_column(Integer)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    exported_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
