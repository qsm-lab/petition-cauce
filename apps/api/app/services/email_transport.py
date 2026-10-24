"""Abstracción de transporte de email multi-proveedor (config-email-org).

Interfaz común `EmailTransport` + adaptadores por proveedor. En Fase 1 solo se
implementa Resend (D3); SMTP y adaptadores API nativos se agregan on-demand
cumpliendo la misma interfaz. `resolve_transport` elige el transporte de la
organización (su `org_email_config`) o cae al de plataforma (retrocompat, R5).
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, replace
from email.utils import parseaddr
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

    def __init__(self, api_key: str, *, plan: str | None = None, daily_quota: int | None = None):
        self._api_key = api_key
        self._plan = (plan or "").lower() or None
        self._daily_quota = daily_quota

    def capabilities(self) -> TransportCaps:
        caps = _RESEND_PLAN_CAPS.get(self._plan or "free", _RESEND_PLAN_CAPS["free"])
        if self._daily_quota is not None:
            caps = replace(caps, daily_quota=self._daily_quota)
        return caps

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


class SesTransport:
    """Adaptador Amazon SES (API SESv2, ses-transport). Un `SendEmail` por
    mensaje; respeta `ses_max_send_rate` espaciando envíos para evitar
    `Throttling`. SES no reporta consumo por headers: la cuota se cuenta con el
    contador Redis propio (R7)."""

    # Último instante de envío por proceso: compartido entre instancias porque
    # platform_transport() crea una nueva en cada llamada.
    _last_send = 0.0
    _lock: asyncio.Lock | None = None

    def __init__(self, *, region: str, access_key_id: str, secret_access_key: str,
                 configuration_set: str = "", daily_quota: int = 200, max_send_rate: float = 1.0):
        self._region = region
        self._access_key_id = access_key_id
        self._secret_access_key = secret_access_key
        self._configuration_set = configuration_set
        self._daily_quota = daily_quota
        self._min_interval = 1.0 / max_send_rate if max_send_rate > 0 else 0.0

    def capabilities(self) -> TransportCaps:
        return TransportCaps(daily_quota=self._daily_quota, monthly_quota=None,
                             max_batch_size=1, supports_custom_domain=True)

    async def _throttle(self) -> None:
        if not self._min_interval:
            return
        if SesTransport._lock is None:
            SesTransport._lock = asyncio.Lock()
        async with SesTransport._lock:
            wait = SesTransport._last_send + self._min_interval - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
            SesTransport._last_send = time.monotonic()

    async def send(self, msg: EmailMessage) -> SendResult:
        if not self._access_key_id:
            logger.info("[dev] email | to=%s | subject=%s", msg.to, msg.subject)
            return SendResult(ok=True)
        params: dict = {
            "FromEmailAddress": msg.from_,
            "Destination": {"ToAddresses": list(msg.to)},
            "Content": {"Simple": {
                "Subject": {"Data": msg.subject, "Charset": "UTF-8"},
                "Body": {"Html": {"Data": msg.html, "Charset": "UTF-8"}},
            }},
        }
        if msg.reply_to:
            params["ReplyToAddresses"] = [msg.reply_to]
        if self._configuration_set:
            params["ConfigurationSetName"] = self._configuration_set
        await self._throttle()
        try:
            import aioboto3

            session = aioboto3.Session(
                aws_access_key_id=self._access_key_id,
                aws_secret_access_key=self._secret_access_key,
                region_name=self._region,
            )
            async with session.client("sesv2") as client:
                resp = await client.send_email(**params)
        except Exception as exc:  # noqa: BLE001
            # R8: solo el código de error de AWS; sin destinatarios en el log.
            code = getattr(exc, "response", {}).get("Error", {}).get("Code") if hasattr(exc, "response") else None
            code = code or type(exc).__name__
            logger.error("[ses] send failed: %s", code)
            return SendResult(ok=False, error=code)
        return SendResult(ok=True, provider_id=resp.get("MessageId"))


class BrevoTransport:
    """Adaptador Brevo (API v3, brevo-pool). `POST /v3/smtp/email` con header
    `api-key`. Brevo no reporta consumo por header: la cuota se cuenta con el
    contador Redis propio (R10)."""

    _URL = "https://api.brevo.com/v3/smtp/email"

    def __init__(self, api_key: str, *, daily_quota: int | None = 300):
        self._api_key = api_key
        self._daily_quota = daily_quota

    def capabilities(self) -> TransportCaps:
        return TransportCaps(daily_quota=self._daily_quota, monthly_quota=None,
                             max_batch_size=1, supports_custom_domain=True)

    async def send(self, msg: EmailMessage) -> SendResult:
        if not self._api_key:
            logger.info("[dev] email | to=%s | subject=%s", msg.to, msg.subject)
            return SendResult(ok=True)
        name, addr = parseaddr(msg.from_)
        sender: dict = {"email": addr or msg.from_}
        if name:
            sender["name"] = name
        payload: dict = {
            "sender": sender,
            "to": [{"email": e} for e in msg.to],
            "subject": msg.subject,
            "htmlContent": msg.html,
        }
        if msg.reply_to:
            payload["replyTo"] = {"email": parseaddr(msg.reply_to)[1] or msg.reply_to}
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.post(
                    self._URL,
                    headers={"api-key": self._api_key, "accept": "application/json",
                             "content-type": "application/json"},
                    json=payload,
                )
            except Exception as exc:  # noqa: BLE001
                logger.error("[brevo] send failed: %s", type(exc).__name__)
                return SendResult(ok=False, error=type(exc).__name__)
        if resp.status_code not in (200, 201):
            # R2: solo el código HTTP; nunca la clave ni el cuerpo con destinatarios.
            logger.error("[brevo] error %s", resp.status_code)
            return SendResult(ok=False, error="rate_limited" if resp.status_code == 429 else f"http_{resp.status_code}")
        provider_id = None
        try:
            provider_id = resp.json().get("messageId")
        except Exception:  # noqa: BLE001
            pass
        return SendResult(ok=True, provider_id=provider_id)


# Registro de proveedores → clase adaptadora.
TRANSPORTS = {"resend": ResendTransport}


def resolve_sender(campaign_meta: dict | None, org_cfg, org) -> dict:
    """Resuelve el remitente con herencia campaña→org→plataforma (R9, D2).

    El `from` de la campaña (cosmético, en `campaign.meta`) se valida contra
    `allowed_domains` de la org; si no pertenece, degrada al default de la org
    (o plataforma). Devuelve `{from_, reply_to}` listos para `_send`.
    """
    meta = campaign_meta or {}
    org_from = (getattr(org_cfg, "default_from", None) if org_cfg else None) or default_from_email()
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


def default_from_email() -> str:
    """Remitente por defecto según el proveedor de plataforma activo (R5)."""
    if settings.email_provider == "ses":
        return settings.ses_from_email or settings.resend_from_email
    if settings.email_provider == "brevo":
        return settings.brevo_from_email or settings.resend_from_email
    return settings.resend_from_email


def email_enabled() -> bool:
    """¿Hay un proveedor de plataforma configurado para enviar? Sustituye a las
    guardas `if not settings.resend_api_key` (R4); sin él, los flujos hacen
    log `[dev]` y no envían."""
    return settings.provider_configured(settings.email_provider)


def platform_transport_for(name: str) -> EmailTransport:
    """Transporte de plataforma de un proveedor concreto (fábrica por nombre,
    brevo-pool). Para el plan Resend se usa el de la cuenta de PLATAFORMA
    (`settings.resend_platform_plan`), con override opcional del cupo diario."""
    if name == "ses":
        return SesTransport(
            region=settings.aws_region,
            access_key_id=settings.aws_access_key_id,
            secret_access_key=settings.aws_secret_access_key,
            configuration_set=settings.ses_configuration_set,
            daily_quota=settings.ses_daily_quota,
            max_send_rate=settings.ses_max_send_rate,
        )
    if name == "brevo":
        return BrevoTransport(settings.brevo_api_key, daily_quota=settings.brevo_daily_quota)
    return ResendTransport(
        settings.resend_api_key, plan=settings.resend_platform_plan, daily_quota=settings.resend_daily_quota,
    )


def platform_transport() -> EmailTransport:
    """Transporte por defecto de la plataforma (según `EMAIL_PROVIDER`). Fallback
    para organizaciones sin configuración propia (R5). Los correos transaccionales
    usan siempre este (brevo-pool R12)."""
    return platform_transport_for(settings.email_provider)


@dataclass
class PoolMember:
    name: str
    transport: EmailTransport
    quota_key: str
    daily_quota: int | None


def platform_pool() -> list[PoolMember]:
    """Proveedores de plataforma de la cola, en orden de prioridad (brevo-pool
    R5). Sin `EMAIL_POOL`, un solo miembro = `EMAIL_PROVIDER` (comportamiento
    anterior)."""
    from app.services.email_quota import platform_quota_key

    names = settings.email_pool_list or [settings.email_provider]
    members = []
    for name in names:
        tr = platform_transport_for(name)
        members.append(PoolMember(name, tr, platform_quota_key(name), tr.capabilities().daily_quota))
    return members


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
