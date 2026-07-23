import uuid
from typing import Literal
from pydantic import BaseModel, field_validator


class SignatureCreate(BaseModel):
    signer_type: Literal["natural", "org"] = "natural"
    org_name: str | None = None
    name: str
    email: str
    cedula: str | None = None
    celular: str | None = None
    location_mode: Literal["nacional", "internacional"] = "nacional"
    provincia: str | None = None
    country: str | None = None
    visibility: str = "anonima"
    consent: bool
    subscribe_newsletter: bool = False
    cf_turnstile_token: str = ""

    @field_validator("visibility", mode="before")
    @classmethod
    def normalize_visibility(cls, v: str) -> str:
        mapping = {
            "pub": "publica", "anon": "anonima", "sec": "secreta",
            "publica": "publica", "anonima": "anonima", "secreta": "secreta",
        }
        result = mapping.get(str(v).strip().lower())
        if not result:
            raise ValueError("visibility debe ser pub/anon/sec")
        return result

    @field_validator("consent")
    @classmethod
    def require_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError("El consentimiento es obligatorio")
        return v


class SignatureCreated(BaseModel):
    id: uuid.UUID
    status: str


class RecentSignatureItem(BaseModel):
    name_display: str
    provincia: str
    time_ago: str
    is_anon: bool


class ConfirmResponse(BaseModel):
    count: int
    goal: int | None = None


class ResendConfirmationRequest(BaseModel):
    email: str


class CompleteNameRequest(BaseModel):
    name: str
