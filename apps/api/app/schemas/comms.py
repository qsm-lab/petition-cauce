from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CtaButtonIn(BaseModel):
    text: str = ""
    url: str = ""
    enabled: bool = True


class AudienceIn(BaseModel):
    """Checkboxes de segmentación (R8) — ver AudienceFilter en comms_service."""
    include_confirmed: bool = True
    include_pending: bool = False
    signer_types: list[str] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=list)
    visibilities: list[str] = Field(default_factory=list)


class RecipientsCountRequest(BaseModel):
    type: str
    audience: AudienceIn = Field(default_factory=AudienceIn)


class CommsPreviewRequest(BaseModel):
    type: str
    subject: str
    # Título (H1) dentro del cuerpo del email — editable por el admin, ya no
    # fijo por tipo.
    heading: str = ""
    body_html: str
    ctas: list[CtaButtonIn] = Field(default_factory=list)
    include_social: bool = False


class CommsSendRequest(CommsPreviewRequest):
    audience: AudienceIn = Field(default_factory=AudienceIn)
    test_emails: list[str] = Field(default_factory=list)


class DraftSaveRequest(CommsPreviewRequest):
    """R22: guardar/actualizar un borrador server-side. `draft_id` presente
    ⇒ actualiza ese borrador in-place; ausente ⇒ crea uno nuevo."""
    audience: AudienceIn = Field(default_factory=AudienceIn)
    draft_id: str | None = None


class ScheduleRequest(CommsPreviewRequest):
    """R12: programa un envío futuro; puede promover un borrador existente
    (`draft_id`) o crear uno nuevo directamente en estado `pending`."""
    audience: AudienceIn = Field(default_factory=AudienceIn)
    scheduled_at: datetime
    draft_id: str | None = None


class ScheduledSendOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    comms_class: str
    subject: str
    heading: str
    status: str
    scheduled_at: datetime | None
    recipient_count: int
    sent_count: int
    failed_count: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_str_ids(cls, obj) -> "ScheduledSendOut":
        return cls(
            id=str(obj.id), type=obj.type, comms_class=obj.comms_class, subject=obj.subject,
            heading=obj.heading, status=obj.status, scheduled_at=obj.scheduled_at,
            recipient_count=obj.recipient_count, sent_count=obj.sent_count, failed_count=obj.failed_count,
            created_at=obj.created_at, updated_at=obj.updated_at,
        )


class DraftOut(ScheduledSendOut):
    body_html: str
    ctas: list[CtaButtonIn]
    include_social: bool
    audience: AudienceIn

    @classmethod
    def from_orm_str_ids(cls, obj) -> "DraftOut":
        return cls(
            id=str(obj.id), type=obj.type, comms_class=obj.comms_class, subject=obj.subject,
            heading=obj.heading, status=obj.status, scheduled_at=obj.scheduled_at,
            recipient_count=obj.recipient_count, sent_count=obj.sent_count, failed_count=obj.failed_count,
            created_at=obj.created_at, updated_at=obj.updated_at, body_html=obj.body_html, ctas=obj.ctas or [],
            include_social=obj.include_social, audience=obj.audience or {},
        )


class SendLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    comms_class: str
    subject: str
    recipient_count: int
    sent_count: int
    failed_count: int
    mode: str
    trigger: str
    created_at: datetime

    @classmethod
    def from_orm_str_ids(cls, obj) -> "SendLogOut":
        return cls(
            id=str(obj.id), type=obj.type, comms_class=obj.comms_class, subject=obj.subject,
            recipient_count=obj.recipient_count, sent_count=obj.sent_count, failed_count=obj.failed_count,
            mode=obj.mode, trigger=obj.trigger, created_at=obj.created_at,
        )


class CommsQuotaResponse(BaseModel):
    """R21: consumo de cuota del proveedor resuelto por config-email-org, sin
    exponer credenciales — accesible a cualquier usuario con scope de la
    campaña (no solo platform_admin, a diferencia de GET /email-config)."""
    provider: str
    plan: str
    daily_used: int
    daily_quota: int | None
    monthly_used: int
    monthly_quota: int | None
    updated_at: str | None
    sender: str
    org_name: str
