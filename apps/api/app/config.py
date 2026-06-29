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
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15

    default_org_slug: str = "cauce"


settings = Settings()
