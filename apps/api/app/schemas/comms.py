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
