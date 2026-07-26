"""Abstracción de transporte de email multi-proveedor (config-email-org).

Interfaz común `EmailTransport` + adaptadores por proveedor. En Fase 1 solo se
implementa Resend (D3); SMTP y adaptadores API nativos se agregan on-demand
cumpliendo la misma interfaz. `resolve_transport` elige el transporte de la
organización (su `org_email_config`) o cae al de plataforma (retrocompat, R5).
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.config import settings
from app.crypto import decrypt_secret

logger = logging.getLogger(__name__)


@dataclass
class EmailMessage:
    to: list[str]
    subject: str
    html: str
    from_: str
    reply_to: str | None = None


@dataclass
class SendResult:
    ok: bool
    provider_id: str | None = None
    error: str | None = None
    # Consumo de cuota reportado por el proveedor (Resend: headers de respuesta).
    daily_quota_used: int | None = None
    monthly_quota_used: int | None = None


@dataclass
class TransportCaps:
    daily_quota: int | None = None
    monthly_quota: int | None = None
    max_batch_size: int = 1
    supports_scheduled: bool = False
    supports_custom_domain: bool = False


class EmailTransport(Protocol):
    async def send(self, msg: EmailMessage) -> SendResult: ...

    def capabilities(self) -> TransportCaps: ...


# Cuotas por plan de Resend (verificadas). None = sin límite conocido.
_RESEND_PLAN_CAPS = {
    "free": TransportCaps(daily_quota=100, monthly_quota=3000, max_batch_size=100, supports_custom_domain=False),
    "pro": TransportCaps(daily_quota=None, monthly_quota=50000, max_batch_size=100, supports_custom_domain=True),
}


class ResendTransport:
    """Adaptador Resend (API). Envuelve el POST a api.resend.com y captura los
    headers de consumo de cuota (`x-resend-daily/monthly-quota`)."""

    def __init__(self, api_key: str, *, plan: str | None = None):
        self._api_key = api_key
        self._plan = (plan or "").lower() or None

    def capabilities(self) -> TransportCaps:
        return _RESEND_PLAN_CAPS.get(self._plan or "free", _RESEND_PLAN_CAPS["free"])

    async def send(self, msg: EmailMessage) -> SendResult:
        if not self._api_key:
            logger.info("[dev] email | to=%s | subject=%s", msg.to, msg.subject)
            return SendResult(ok=True)
        payload: dict = {
            "from": msg.from_,
            "to": msg.to,
            "subject": msg.subject,
            "html": msg.html,
        }
        if msg.reply_to:
            payload["reply_to"] = msg.reply_to
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            except Exception as exc:  # noqa: BLE001
                logger.error("[resend] send failed: %s", exc)
                return SendResult(ok=False, error=str(exc))
        daily = _as_int(resp.headers.get("x-resend-daily-quota"))
        monthly = _as_int(resp.headers.get("x-resend-monthly-quota"))
        if resp.status_code not in (200, 201):
            logger.error("[resend] error %s: %s", resp.status_code, resp.text)
            return SendResult(ok=False, error=f"http_{resp.status_code}",
                              daily_quota_used=daily, monthly_quota_used=monthly)
        provider_id = None
        try:
            provider_id = resp.json().get("id")
        except Exception:  # noqa: BLE001
            pass
        return SendResult(ok=True, provider_id=provider_id,
                          daily_quota_used=daily, monthly_quota_used=monthly)


def _as_int(v: str | None) -> int | None:
    try:
        return int(v) if v is not None else None
    except (TypeError, ValueError):
        return None


# Registro de proveedores → clase adaptadora. Fase 1: solo Resend.
TRANSPORTS = {"resend": ResendTransport}


def resolve_sender(campaign_meta: dict | None, org_cfg, org) -> dict:
    """Resuelve el remitente con herencia campaña→org→plataforma (R9, D2).

    El `from` de la campaña (cosmético, en `campaign.meta`) se valida contra
    `allowed_domains` de la org; si no pertenece, degrada al default de la org
    (o plataforma). Devuelve `{from_, reply_to}` listos para `_send`.
    """
    meta = campaign_meta or {}
    org_from = (getattr(org_cfg, "default_from", None) if org_cfg else None) or settings.resend_from_email
    from_ = meta.get("sender_from") or org_from
    display = (
        meta.get("sender_display_name")
        or (getattr(org_cfg, "default_display_name", None) if org_cfg else None)
        or (getattr(org, "name", None) if org else None)
    )
    reply_to = (
        meta.get("sender_reply_to")
        or (getattr(org_cfg, "default_reply_to", None) if org_cfg else None)
        or (getattr(org, "contact_email", None) if org else None)
    )
    allowed = (getattr(org_cfg, "allowed_domains", None) if org_cfg else None) or []
    if allowed and from_ and "@" in from_:
        domain = from_.rsplit("@", 1)[1].lower()
        if domain not in [d.lower() for d in allowed]:
            from_ = org_from  # el from de la campaña no está en un dominio permitido
    header_from = f"{display} <{from_}>" if display else from_
    return {"from_": header_from, "reply_to": reply_to}


def platform_transport() -> ResendTransport:
    """Transporte por defecto de la plataforma (Resend global actual). Fallback
    para organizaciones sin configuración propia (R5)."""
    return ResendTransport(settings.resend_api_key, plan=None)


async def resolve_transport_for_org(db, org_id) -> EmailTransport:
    """Devuelve el transporte de la organización (su `org_email_config` activa) o
    el de plataforma si no tiene configuración (R5). El llamador debe tener el
    contexto RLS seteado (current_org_id de la org o is_platform_admin)."""
    from sqlalchemy import select
    from app.models.org_email_config import OrgEmailConfig

    result = await db.execute(
        select(OrgEmailConfig).where(
            OrgEmailConfig.org_id == org_id,
            OrgEmailConfig.status == "active",
        )
    )
    cfg = result.scalar_one_or_none()
    if cfg is None:
        return platform_transport()
    return transport_from_config(cfg)


def transport_from_config(cfg) -> EmailTransport:
    """Instancia el adaptador a partir de un `OrgEmailConfig`. Descifra las
    credenciales en memoria. Si el proveedor no está registrado o faltan
    credenciales, cae al transporte de plataforma (defensivo)."""
    provider = (cfg.provider or "resend").lower()
    adapter_cls = TRANSPORTS.get(provider)
    if adapter_cls is None or not cfg.credentials_encrypted:
        logger.warning("[email_transport] proveedor '%s' no disponible; usa plataforma", provider)
        return platform_transport()
    try:
        creds = json.loads(decrypt_secret(cfg.credentials_encrypted))
    except Exception as exc:  # noqa: BLE001
        logger.error("[email_transport] no se pudieron descifrar credenciales de org %s: %s", cfg.org_id, exc)
        return platform_transport()
    if provider == "resend":
        return ResendTransport(creds.get("api_key", ""), plan=cfg.plan)
    return platform_transport()
