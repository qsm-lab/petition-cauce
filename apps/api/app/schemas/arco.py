import uuid
from pydantic import BaseModel

# Respuesta anti-enumeración (R2, R12): siempre el mismo mensaje, exista o no
# coincidencia, esté o no la firma ya anonimizada.
_GENERIC_MESSAGE = "Si existen datos asociados a estos datos, enviaremos un enlace de verificación al correo registrado."


class ArcoAccessRequest(BaseModel):
    email: str
    cedula: str
    cf_turnstile_token: str = ""
    origin_campaign_id: str | None = None


class ArcoGenericResponse(BaseModel):
    ok: bool = True
    message: str = _GENERIC_MESSAGE


class ArcoVerifyRequest(BaseModel):
    token: str
    origin_campaign_id: str | None = None


class ArcoPortalSessionResponse(BaseModel):
    portal_token: str
    expires_at: str


class ArcoConsentSummary(BaseModel):
    text_snapshot: str
    version: str
    legal_basis: str
    consented_at: str | None
    notify_updates: bool
    subscribe_newsletter: bool


class ArcoCampaignSummary(BaseModel):
    signature_id: uuid.UUID
    campaign_id: uuid.UUID
    campaign_title: str
    visibility: str
    status: str
    signable: bool
    is_origin: bool
    confirmed_at: str | None
    created_at: str
    just_auto_confirmed: bool
    consent: ArcoConsentSummary | None
    # Por campaña (R6b) — editables bajo reglas distintas a los datos personales compartidos
    signer_type: str
    org_name: str | None
    location_mode: str
    provincia: str | None
    country: str | None
    # Estructura (tipo de firmante/ubicación) solo editable mientras la firma
    # sigue pendiente y la campaña acepta firmas
    profile_editable: bool


class ArcoDataResponse(BaseModel):
    name: str | None
    email_masked: str
    cedula_masked: str | None
    celular_masked: str | None
    campaigns: list[ArcoCampaignSummary]


class ArcoPersonalDataRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    cedula: str | None = None
    celular: str | None = None


class ArcoPersonalDataConflict(BaseModel):
    campaign_id: uuid.UUID
    campaign_title: str
    field: str
    reason: str


class ArcoPersonalDataResponse(BaseModel):
    ok: bool = True
    message: str = "Tus datos personales fueron actualizados."
    conflicts: list[ArcoPersonalDataConflict] = []


class ArcoVisibilityRequest(BaseModel):
    signature_id: uuid.UUID
    visibility: str


class ArcoCampaignProfileRequest(BaseModel):
    signature_id: uuid.UUID
    signer_type: str | None = None
    org_name: str | None = None
    location_mode: str | None = None
    provincia: str | None = None
    country: str | None = None


class ArcoOpposeRequest(BaseModel):
    signature_id: uuid.UUID
    notify_updates: bool | None = None
    subscribe_newsletter: bool | None = None


class ArcoConfirmRequest(BaseModel):
    signature_id: uuid.UUID


class ArcoDeleteRequest(BaseModel):
    signature_id: uuid.UUID
