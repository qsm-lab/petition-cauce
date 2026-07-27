"""Administración de la config de email por organización (config-email-org).

Solo `platform_admin` la gestiona (D5). Las credenciales se cifran en reposo
(`sec:v1:`) y nunca se devuelven en claro (R3). El envío de prueba (R4) valida
la config antes de confiar en ella.
"""
import json
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crypto import encrypt_secret
from app.models.org_email_config import OrgEmailConfig
from app.schemas.org_email_config import OrgEmailConfigResponse, OrgEmailConfigUpdate
from app.services.email_quota import get_usage, record_usage
from app.services.email_transport import EmailMessage, transport_from_config

logger = logging.getLogger(__name__)


def _build_credentials(provider: str, data: OrgEmailConfigUpdate) -> dict | None:
    """Arma el dict de credenciales a cifrar según el proveedor. None si no se
    proporcionaron credenciales nuevas (se conservan las existentes)."""
    if provider == "resend":
        return {"api_key": data.api_key} if data.api_key else None
    if provider == "smtp":
        if data.smtp_host:
            return {
                "host": data.smtp_host,
                "port": data.smtp_port,
                "user": data.smtp_user,
                "pass": data.smtp_password,
                "tls": data.smtp_tls if data.smtp_tls is not None else True,
            }
    return None


async def to_response(cfg: OrgEmailConfig) -> OrgEmailConfigResponse:
    try:
        usage = await get_usage(str(cfg.id))
    except Exception:  # noqa: BLE001
        logger.warning("[email_quota] no se pudo leer el consumo de %s", cfg.id)
        usage = {"daily_used": 0, "monthly_used": 0, "provider_snapshot": None}
    return OrgEmailConfigResponse(
        org_id=cfg.org_id,
        provider=cfg.provider,
        plan=cfg.plan,
        daily_quota=cfg.daily_quota,
        monthly_quota=cfg.monthly_quota,
        default_from=cfg.default_from,
        default_reply_to=cfg.default_reply_to,
        default_display_name=cfg.default_display_name,
        allowed_domains=cfg.allowed_domains or [],
        status=cfg.status,
        has_credentials=bool(cfg.credentials_encrypted),
        verified_at=cfg.verified_at,
        daily_used=usage["daily_used"],
        monthly_used=usage["monthly_used"],
        provider_snapshot=usage["provider_snapshot"],
    )


class OrgEmailConfigService:
    @staticmethod
    async def get(db: AsyncSession, org_id: uuid.UUID) -> OrgEmailConfig | None:
        result = await db.execute(
            select(OrgEmailConfig).where(OrgEmailConfig.org_id == org_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def upsert(
        db: AsyncSession, org_id: uuid.UUID, data: OrgEmailConfigUpdate,
        created_by: uuid.UUID | None,
    ) -> OrgEmailConfig:
        cfg = await OrgEmailConfigService.get(db, org_id)
        creds = _build_credentials(data.provider, data)

        if cfg is None:
            cfg = OrgEmailConfig(org_id=org_id, provider=data.provider, created_by=created_by)
            db.add(cfg)
        cfg.provider = data.provider
        if creds is not None:
            cfg.credentials_encrypted = encrypt_secret(json.dumps(creds))
        # Campos no-secretos: se actualizan si vienen (None = no tocar).
        for field in ("plan", "daily_quota", "monthly_quota", "default_from",
                      "default_reply_to", "default_display_name", "status"):
            v = getattr(data, field)
            if v is not None:
                setattr(cfg, field, v)
        if data.allowed_domains is not None:
            cfg.allowed_domains = data.allowed_domains
        await db.commit()
        await db.refresh(cfg)
        return cfg

    @staticmethod
    async def delete(db: AsyncSession, org_id: uuid.UUID) -> bool:
        cfg = await OrgEmailConfigService.get(db, org_id)
        if cfg is None:
            return False
        await db.delete(cfg)
        await db.commit()
        return True

    @staticmethod
    async def send_test(db: AsyncSession, org_id: uuid.UUID, to: str) -> bool:
        """Envía un email de prueba con la config guardada de la org (R4)."""
        cfg = await OrgEmailConfigService.get(db, org_id)
        if cfg is None:
            return False
        transport = transport_from_config(cfg)
        from_ = cfg.default_from or settings.resend_from_email
        display = cfg.default_display_name
        header_from = f"{display} <{from_}>" if display else from_
        msg = EmailMessage(
            to=[to],
            subject="Prueba de configuración de email — Cauce",
            html="<p>Esta es una prueba de la configuración de envío de tu organización en Cauce. "
                 "Si la recibiste, el proveedor está configurado correctamente.</p>",
            from_=header_from,
            reply_to=cfg.default_reply_to,
        )
        result = await transport.send(msg)
        if result.ok:
            try:
                await record_usage(
                    str(cfg.id),
                    daily_quota_used=result.daily_quota_used,
                    monthly_quota_used=result.monthly_quota_used,
                )
            except Exception:  # noqa: BLE001
                logger.warning("[email_quota] no se pudo registrar el consumo de %s", cfg.id)
        return result.ok
