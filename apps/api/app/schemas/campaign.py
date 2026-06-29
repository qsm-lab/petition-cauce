from pydantic import BaseModel
import uuid
from datetime import datetime


class CampaignCreate(BaseModel):
    form_id: uuid.UUID | None = None
    title: str
    slug: str
    access_mode: str = "public"
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    max_responses: int | None = None
    source_platform: str | None = None
    quota_config: dict = {}


class CampaignUpdate(BaseModel):
    title: str | None = None
    form_id: uuid.UUID | None = None
    access_mode: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    max_responses: int | None = None
    source_platform: str | None = None
    quota_config: dict | None = None


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


class CampaignResponse(BaseModel):
    id: uuid.UUID
    form_id: uuid.UUID | None = None
    created_by: uuid.UUID
    title: str
    slug: str
    status: str
    access_mode: str
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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
