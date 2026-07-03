import uuid
from datetime import datetime
from pydantic import BaseModel


class PrivacyPolicyCreate(BaseModel):
    title: str
    aviso_firmante: str = ""
    aviso_organizacion: str = ""
    base_legal: str = "consentimiento_expreso"
    data_contact_email: str | None = None


class PrivacyPolicyUpdate(BaseModel):
    title: str | None = None
    aviso_firmante: str | None = None
    aviso_organizacion: str | None = None
    base_legal: str | None = None
    data_contact_email: str | None = None


class PrivacyPolicyResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    title: str
    aviso_firmante: str
    aviso_organizacion: str
    version: int
    base_legal: str
    data_contact_email: str | None
    archived_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
