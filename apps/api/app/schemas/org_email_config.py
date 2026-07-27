import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class OrgEmailConfigUpdate(BaseModel):
    """Alta/edición de la config de email de una org (config-email-org). Las
    credenciales se cifran y NUNCA se devuelven; si no se envían en un update,
    se conservan las existentes."""
    provider: str = "resend"
    # Credenciales por proveedor (se cifran juntas). Resend: api_key.
    # SMTP (Fase 2): smtp_host/port/user/password/tls.
    api_key: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_tls: bool | None = None
    plan: str | None = None
    daily_quota: int | None = None
    monthly_quota: int | None = None
    default_from: str | None = None
    default_reply_to: str | None = None
    default_display_name: str | None = None
    allowed_domains: list[str] | None = None
    status: str | None = None


class OrgEmailConfigResponse(BaseModel):
    """Vista de la config SIN secretos (R3): solo estado y metadatos."""
    org_id: uuid.UUID
    provider: str
    plan: str | None
    daily_quota: int | None
    monthly_quota: int | None
    default_from: str | None
    default_reply_to: str | None
    default_display_name: str | None
    allowed_domains: list
    status: str
    has_credentials: bool
    verified_at: datetime | None
    # Consumo de cuota por credencial (R7) — contador propio (provider-agnóstico)
    # + último snapshot reportado por el proveedor si lo expone (Resend; None
    # para adaptadores que no lo reportan, p. ej. SMTP).
    daily_used: int = 0
    monthly_used: int = 0
    provider_snapshot: dict[str, Any] | None = None


class OrgEmailTestRequest(BaseModel):
    to: str
