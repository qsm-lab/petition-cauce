import uuid
from typing import Literal
from pydantic import BaseModel, field_validator, model_validator


_NAME_PART_MAX = 120


class SignatureCreate(BaseModel):
    signer_type: Literal["natural", "org"] = "natural"
    org_name: str | None = None
    # revision-datos-al-firmar: el formulario envía first_name + last_name; `name` solo lo envía un cliente anterior (transición).
    name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
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

    @model_validator(mode="after")
    def compose_name(self):
        """Con first_name/last_name, `name` es su composición; con solo `name` (cliente anterior) se acepta tal cual."""
        first = " ".join((self.first_name or "").split())
        last = " ".join((self.last_name or "").split())
        if first or last:
            if not first or not last:
                raise ValueError("Nombre y apellido son obligatorios")
            if len(first) > _NAME_PART_MAX or len(last) > _NAME_PART_MAX:
                raise ValueError("Nombre o apellido demasiado largo")
            self.first_name, self.last_name = first, last
            self.name = f"{first} {last}"
        elif not (self.name or "").strip():
            raise ValueError("El nombre es obligatorio")
        return self


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


class NewsletterConsentRequest(BaseModel):
    token: str
    notify_updates: bool
