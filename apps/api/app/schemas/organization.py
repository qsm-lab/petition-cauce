import uuid
from datetime import datetime
from pydantic import BaseModel


class OrganizationCreate(BaseModel):
    name: str
    slug: str
    domain: str | None = None
    description: str | None = None
    logo_url: str | None = None
    contact_email: str | None = None
    domains: list[str] = []
    rep_name: str | None = None
    status: str = "pendiente"


class OrganizationUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    domain: str | None = None
    description: str | None = None
    logo_url: str | None = None
    contact_email: str | None = None
    domains: list[str] | None = None
    rep_name: str | None = None
    status: str | None = None


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    domain: str | None
    description: str | None
    logo_url: str | None
    contact_email: str | None
    domains: list
    rep_name: str | None
    status: str
    archived_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
