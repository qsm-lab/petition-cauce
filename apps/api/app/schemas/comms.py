from pydantic import BaseModel, Field


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
    body_html: str
    ctas: list[CtaButtonIn] = Field(default_factory=list)
    include_social: bool = False


class CommsSendRequest(CommsPreviewRequest):
    audience: AudienceIn = Field(default_factory=AudienceIn)
    test_emails: list[str] = Field(default_factory=list)


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
