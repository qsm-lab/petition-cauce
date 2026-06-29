from pydantic import BaseModel
from typing import Any
import uuid
from datetime import datetime


class FormVersionSchema(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID
    version_number: int
    label: str
    snapshot: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class QuestionOptionSchema(BaseModel):
    id: uuid.UUID | None = None
    label: str
    value: str
    order_index: int
    meta: dict = {}

    model_config = {"from_attributes": True}


class QuestionSchema(BaseModel):
    id: uuid.UUID | None = None
    form_id: uuid.UUID | None = None
    code: str
    type: str
    label: str
    description: str | None = None
    is_required: bool = False
    is_pii: bool = False
    order_index: int
    validation: dict = {}
    conditional_logic: dict | None = None
    meta: dict = {}
    options: list[QuestionOptionSchema] = []

    model_config = {"from_attributes": True}


class QuestionCreate(BaseModel):
    code: str | None = None
    type: str
    label: str
    description: str | None = None
    is_required: bool = False
    is_pii: bool = False
    order_index: int = 0
    validation: dict = {}
    conditional_logic: dict | None = None


class QuestionUpdate(BaseModel):
    label: str | None = None
    description: str | None = None
    type: str | None = None
    is_required: bool | None = None
    is_pii: bool | None = None
    validation: dict | None = None
    conditional_logic: dict | None = None


class QuestionOptionCreate(BaseModel):
    label: str
    value: str
    order_index: int = 0
    meta: dict = {}


class QuestionOptionUpdate(BaseModel):
    label: str | None = None
    value: str | None = None
    order_index: int | None = None
    meta: dict | None = None


class ReorderRequest(BaseModel):
    question_ids: list[uuid.UUID]


class FormCreate(BaseModel):
    title: str
    description: str | None = None
    privacy_notice_text: str | None = None
    requires_explicit_consent: bool = False
    consent_text: str | None = None
    consent_version: str = "1.0"


class FormUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    slug: str | None = None
    campaign_id: uuid.UUID | None = None
    privacy_notice_text: str | None = None
    requires_explicit_consent: bool | None = None
    consent_text: str | None = None
    description_font_size: int | None = None
    cover_image_url: str | None = None
    og_description: str | None = None
    og_image_alt: str | None = None


class FormResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    created_by: uuid.UUID
    campaign_id: uuid.UUID | None = None
    slug: str | None = None
    title: str
    description: str | None
    status: str
    privacy_notice_text: str | None = None
    requires_explicit_consent: bool
    consent_text: str | None = None
    consent_version: str | None
    description_font_size: int | None = None
    cover_image_url: str | None = None
    og_description: str | None = None
    og_image_alt: str | None = None
    meta: dict = {}
    created_at: datetime
    updated_at: datetime
    questions: list[QuestionSchema] = []

    model_config = {"from_attributes": True}
