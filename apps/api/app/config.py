from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    debug: bool = False

    # DATABASE_URL usa petition_app (no-superusuario) → RLS activo en runtime
    database_url: str
    # DATABASE_URL_SYNC usa petition_admin (superusuario) → Alembic bypasea RLS para migraciones
    database_url_sync: str
    redis_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 120
    jwt_refresh_token_expire_days: int = 7

    turnstile_site_key: str = ""
    turnstile_secret_key: str = ""

    api_port: int = 8000
    api_host: str = "0.0.0.0"
    cors_origins: List[str] = ["http://localhost:3002"]
    api_export_key: str = ""

    api_internal_url: str = "http://petition-api:8000"
    next_public_api_url: str = ""
    next_public_turnstile_site_key: str = ""
    next_public_app_url: str = ""

    rate_limit_submit_per_minute: int = 10
    rate_limit_api_per_minute: int = 60

    # HMAC_SECRET_KEY — obligatoria; usar valor distinto al de proy_forms-qsm
    hmac_secret_key: str

    # PII_ENCRYPTION_KEY — obligatoria; 64 hex chars (32 bytes, AES-256-GCM).
    # Generar con: openssl rand -hex 32. Distinta de HMAC_SECRET_KEY y de forms-qsm.
    pii_encryption_key: str

    @field_validator("pii_encryption_key")
    @classmethod
    def _validate_pii_key(cls, v: str) -> str:
        v = v.strip()
        if len(v) != 64:
            raise ValueError(
                "PII_ENCRYPTION_KEY debe tener 64 caracteres hex (32 bytes). "
                "Generar con: openssl rand -hex 32"
            )
        int(v, 16)  # lanza ValueError si no es hex
        return v
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15

    default_org_slug: str = "cauce"

    # ── Encargado del tratamiento (Cauce Petition) ─────────────────────────
    # Cambiar a 'juridica' cuando se constituya la entidad legal.
    # 'natural': usar cédula en encargado_cedula_ruc y nombre completo en encargado_nombre.
    # 'juridica': usar RUC, razón social y representante legal.
    encargado_tipo: str = "natural"
    encargado_nombre: str = ""
    encargado_cedula_ruc: str = ""
    encargado_rep_nombre: str = ""       # solo si encargado_tipo = 'juridica'
    encargado_domicilio: str = ""
    encargado_email: str = ""

    # ── Email (Resend) ─────────────────────────────────────────────────────
    resend_api_key: str = ""
    resend_from_email: str = "noreply@cauce.ec"
    # Plan de la cuenta de Resend de PLATAFORMA (el fallback cuando una org no
    # tiene org_email_config propia — platform_transport()). "free" por
    # default (conservador); poner "pro" en producción si la cuenta real está
    # en ese plan, si no el panel de cuota muestra los topes de Free (100/día,
    # 3000/mes) aunque la cuenta real tenga más capacidad.
    resend_platform_plan: str = "free"
    # Clave dedicada para cifrar credenciales de proveedores de email por
    # organización (config-email-org, D6). 64 hex (32 bytes, AES-256-GCM).
    # Si vacía, cae a PII_ENCRYPTION_KEY como fallback operativo — en producción
    # configurar una dedicada. Generar con: openssl rand -hex 32.
    provider_secret_key: str = ""
    api_public_url: str = "http://localhost:8011"
    # Emails de admins de plataforma separados por coma (ej: "a@cauce.ec,b@cauce.ec")
    platform_admin_emails: str = ""

    # ── Uploads del centro de comunicaciones (centro-comunicaciones, Fase 2) ──
    # Volumen del VPS: /data/uploads/<org_id>/<campaign_id>/<uuid>.<ext> (D2).
    uploads_dir: str = "/data/uploads"
    comms_upload_max_bytes: int = 25 * 1024 * 1024

    # ── Cola del centro de comunicaciones (centro-comunicaciones, Fase 3) ──
    comms_queue_poll_seconds: int = 30


settings = Settings()
