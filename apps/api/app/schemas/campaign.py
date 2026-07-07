from pydantic import BaseModel, field_validator
import uuid
from datetime import datetime


class CampaignCreate(BaseModel):
    form_id: uuid.UUID | None = None
    title: str
    petition_title: str | None = None
    slug: str
    access_mode: str = "public"
    category: str | None = None
    goal_count: int | None = None
    authority: str | None = None
    asks: list | None = None
    petition_body: dict | None = None
    hero_image_url: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    max_responses: int | None = None
    source_platform: str | None = None
    quota_config: dict = {}
    org_id: uuid.UUID | None = None
    privacy_policy_id: uuid.UUID | None = None
    # Campos que van a meta
    show_authority: bool | None = None
    show_goal: bool | None = None
    form_config: dict | None = None
    hero_image_mobile_url: str | None = None
    attachments: list | None = None
    show_qr: bool | None = None
    share_text: str | None = None
    # Branding / welcome / social (mismos que CampaignUpdate)
    branding: dict | None = None
    welcome_logo_url: str | None = None
    welcome_title: str | None = None
    welcome_title_size: str | None = None
    welcome_slogan: str | None = None
    welcome_slogan_size: str | None = None
    welcome_description: str | None = None
    welcome_title_color: str | None = None
    welcome_slogan_color: str | None = None
    thank_you_title: str | None = None
    thank_you_body: str | None = None
    social_links: dict | None = None


_META_FIELDS = {
    "show_authority", "show_goal", "form_config", "hero_image_mobile_url",
    "attachments", "show_qr", "share_text",
    # Ciclo de vida: etapas opcionales {"dialogo": bool, "decision": bool}
    "lifecycle_config",
    # Branding
    "branding",
    # Welcome copy
    "welcome_logo_url", "welcome_title", "welcome_title_size",
    "welcome_slogan", "welcome_slogan_size", "welcome_description",
    "welcome_title_color", "welcome_slogan_color",
    # Thank you
    "thank_you_title", "thank_you_body",
    # Social links
    "social_links",
}


class CampaignUpdate(BaseModel):
    title: str | None = None
    petition_title: str | None = None
    form_id: uuid.UUID | None = None
    org_id: uuid.UUID | None = None
    access_mode: str | None = None
    category: str | None = None
    goal_count: int | None = None
    authority: str | None = None
    asks: list | None = None
    petition_body: dict | None = None
    hero_image_url: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    max_responses: int | None = None
    source_platform: str | None = None
    quota_config: dict | None = None
    privacy_policy_id: uuid.UUID | None = None
    # Campos que van a meta (no son columnas directas)
    show_authority: bool | None = None
    show_goal: bool | None = None
    form_config: dict | None = None
    hero_image_mobile_url: str | None = None
    attachments: list | None = None
    show_qr: bool | None = None
    qr_code_data: str | None = None
    share_text: str | None = None
    # Branding (meta.branding — tokens de color para la landing)
    branding: dict | None = None
    # Etapas opcionales del ciclo de vida
    lifecycle_config: dict | None = None
    # Welcome copy
    welcome_logo_url: str | None = None
    welcome_title: str | None = None
    welcome_title_size: str | None = None
    welcome_slogan: str | None = None
    welcome_slogan_size: str | None = None
    welcome_description: str | None = None
    welcome_title_color: str | None = None
    welcome_slogan_color: str | None = None
    # Thank you
    thank_you_title: str | None = None
    thank_you_body: str | None = None
    # Social links
    social_links: dict | None = None


class CampaignStatusUpdate(BaseModel):
    status: str


class CampaignInfoUpdate(BaseModel):
    description: str | None = None
    data_protection_level: str | None = None


class ThankYouUpdate(BaseModel):
    thank_you_title: str | None = None
    thank_you_body: str | None = None


class SocialLinksUpdate(BaseModel):
    instagram: str | None = None
    facebook: str | None = None
    tiktok: str | None = None
    whatsapp: str | None = None
    newsletter: str | None = None
    website: str | None = None
    share_text: str | None = None


class WelcomeConfigUpdate(BaseModel):
    welcome_logo_url: str | None = None
    welcome_title: str | None = None
    welcome_title_size: str | None = None
    welcome_description: str | None = None
    welcome_slogan: str | None = None
    welcome_slogan_size: str | None = None
    welcome_title_color: str | None = None
    welcome_slogan_color: str | None = None
    slug: str | None = None
    status: str | None = None


class LifecycleEventOut(BaseModel):
    id: uuid.UUID
    stage: str
    stage_index: int
    notes: str | None = None
    registered_at: datetime
    registered_by: uuid.UUID | None = None

    model_config = {"from_attributes": True}


class LifecycleStageUpdate(BaseModel):
    stage: int
    notes: str | None = None
    notify_org: bool = False

    @field_validator("stage")
    @classmethod
    def stage_in_range(cls, v: int) -> int:
        if not 0 <= v <= 4:
            raise ValueError("stage debe estar entre 0 y 4")
        return v


class NotifySignersRequest(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El mensaje no puede estar vacío")
        return v


class CampaignResponse(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID | None = None
    created_by: uuid.UUID
    org_id: uuid.UUID
    title: str
    petition_title: str | None = None
    slug: str
    status: str
    access_mode: str
    category: str | None = None
    goal_count: int | None = None
    authority: str | None = None
    asks: list = []
    privacy_policy_id: uuid.UUID | None = None
    petition_body: dict = {}
    hero_image_url: str | None = None
    starts_at: datetime | None
    ends_at: datetime | None
    max_responses: int | None
    source_platform: str | None
    quota_config: dict
    description: str | None = None
    data_protection_level: str | None = None
    social_links: dict = {}
    share_text: str | None = None
    thank_you_title: str | None = None
    thank_you_body: str | None = None
    welcome_logo_url: str | None = None
    welcome_title: str | None = None
    welcome_title_size: str | None = None
    welcome_description: str | None = None
    welcome_slogan: str | None = None
    welcome_slogan_size: str | None = None
    welcome_title_color: str = "#FFFFFF"
    welcome_slogan_color: str = "#FFFFFF"
    lifecycle_stage: int = 0
    meta: dict = {}
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminCampaignDetailResponse(CampaignResponse):
    lifecycle_events: list[LifecycleEventOut] = []
    org_name: str | None = None
    org_has_contact_email: bool = False
