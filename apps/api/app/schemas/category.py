import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator
import re


def _to_slug(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[áàäâ]", "a", s)
    s = re.sub(r"[éèëê]", "e", s)
    s = re.sub(r"[íìïî]", "i", s)
    s = re.sub(r"[óòöô]", "o", s)
    s = re.sub(r"[úùüû]", "u", s)
    s = re.sub(r"ñ", "n", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:60]


class CategoryCreate(BaseModel):
    name: str
    slug: str | None = None
    color: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("slug", mode="before")
    @classmethod
    def auto_slug(cls, v, info):
        if not v:
            name = (info.data or {}).get("name", "")
            return _to_slug(name)
        return v


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    color: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, v):
        return v.strip() if isinstance(v, str) else v


class CategoryResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID | None
    name: str
    slug: str
    color: str | None
    archived_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
