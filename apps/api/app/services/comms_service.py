"""Centro de comunicaciones: sanitización de contenido, segmentación de
destinatarios por clase LOPDP y armado del HTML final del envío.

No define transporte ni credenciales propias — el remitente y el proveedor
los resuelve `config-email-org` (D3, R16). El "editor WYSIWYG" produce HTML
libre que SIEMPRE se sanitiza (R6) antes de envolverse en la plantilla
email-safe de la plataforma.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field

import nh3
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crypto import PIIDecryptError, decrypt_pii
from app.models.consent import Consent
from app.models.signature import Signature
from app.services.email_service import (
    _PLATFORM_FOOTER_HTML,
    _powered_by_block,
    _social_href,
    _social_icon_links,
)

# Tipos de envío del centro (Fase 1) → clase LOPDP fija por tipo (D1, R9).
# "Mensaje general" es la única clase Anuncios; el resto es Servicio.
COMMS_TYPES: dict[str, str] = {
    "general": "anuncios",
    "invitation": "servicio",
    "closing": "servicio",
}

_ALLOWED_TAGS = {
    "p", "h1", "h2", "h3", "strong", "em", "u", "s", "ul", "ol", "li",
    "blockquote", "a", "img", "br", "span",
}
_ALLOWED_ATTRIBUTES = {
    "a": {"href"},
    "img": {"src", "alt"},
}


def _uploads_origin() -> str:
    return (settings.next_public_app_url or "").rstrip("/")


def _restrict_img_src(tag: str, attr: str, value: str) -> str | None:
    """R6: img@src solo puede apuntar al dominio de uploads de la plataforma
    (evita hotlink a terceros / tracking pixels no deseados en el editor)."""
    if tag == "img" and attr == "src":
        origin = _uploads_origin()
        if not origin or not value.startswith(origin):
            return None
    return value


def sanitize_comms_html(html: str) -> str:
    """R6: sanitiza el HTML del editor contra una allowlist explícita antes de
    guardarse o enviarse — nunca se envía HTML crudo del admin."""
    if not html:
        return ""
    return nh3.clean(
        html,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        attribute_filter=_restrict_img_src,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer",
    )


@dataclass
class AudienceFilter:
    """Checkboxes de segmentación (R8) — "incluir todos, desmarcar para
    excluir". `None`/vacío en signer_types/locations/visibilities = sin
    restricción (todas). `include_pending` se acepta por compatibilidad de
    forma pero Fase 1 lo ignora (ver `build_segment_filters`, R11)."""
    include_confirmed: bool = True
    include_pending: bool = False
    signer_types: list[str] = field(default_factory=list)
    locations: list[str] = field(default_factory=list)
    visibilities: list[str] = field(default_factory=list)


class InvalidCommsType(ValueError):
    pass


def build_segment_filters(campaign_id: uuid.UUID, comms_type: str, audience: AudienceFilter) -> tuple[list, str]:
    """Arma los filtros SQLAlchemy del segmento y devuelve (filtros, clase).

    R11 — la clase acota el universo ANTES de la segmentación, sin excepción
    (el backend la impone independientemente de lo que envíe el cliente):
    - anuncios: solo notify_updates=true AND status=confirmed AND archived_at
      IS NULL. El filtro notify_updates se aplica vía join a Consent en el
      llamador (build_segment_filters no conoce la tabla Consent).
    - servicio: firmantes de la propia campaña, siempre confirmed en Fase 1
      (ninguno de los 3 tipos del centro es un "recordatorio de confirmación"
      — ese tipo, si se agrega, sería el único que habilite pending_confirmation).
    - Las secretas nunca se exponen: fuera de la segmentación posible.
    """
    if comms_type not in COMMS_TYPES:
        raise InvalidCommsType(comms_type)
    clase = COMMS_TYPES[comms_type]

    filters = [
        Signature.campaign_id == campaign_id,
        Signature.archived_at.is_(None),
        Signature.status == "confirmed",
    ]

    visibilidades_permitidas = {"publica", "anonima"}
    seleccion_vis = set(audience.visibilities) & visibilidades_permitidas if audience.visibilities else visibilidades_permitidas
    filters.append(Signature.visibility.in_(seleccion_vis or visibilidades_permitidas))

    if audience.signer_types:
        tipos = set(audience.signer_types) & {"natural", "org"}
        if tipos:
            filters.append(Signature.signer_type.in_(tipos))

    if audience.locations:
        loc_filters = []
        if "nacional" in audience.locations:
            loc_filters.append(Signature.country.is_(None))
        if "internacional" in audience.locations:
            loc_filters.append(Signature.country.isnot(None))
        if loc_filters:
            filters.append(or_(*loc_filters))

    return filters, clase


async def count_recipients(db: AsyncSession, campaign_id: uuid.UUID, comms_type: str, audience: AudienceFilter) -> int:
    """R10: conteo en vivo del segmento — barato (COUNT), sin descifrar PII."""
    filters, clase = build_segment_filters(campaign_id, comms_type, audience)
    query = select(func.count(func.distinct(Signature.id)))
    if clase == "anuncios":
        query = query.join(Consent, Consent.signature_id == Signature.id).where(
            Consent.notify_updates.is_(True), *filters
        )
    else:
        query = query.where(*filters)
    result = await db.execute(query)
    return result.scalar() or 0


async def get_recipients(
    db: AsyncSession, campaign_id: uuid.UUID, comms_type: str, audience: AudienceFilter
) -> list[tuple[str, str]]:
    """(email, nombre) descifrados del segmento — nunca expone PII de
    firmas secretas (fuera del universo posible) ni de archivadas."""
    filters, clase = build_segment_filters(campaign_id, comms_type, audience)
    query = select(Signature.id, Signature.email_encrypted, Signature.name)
    if clase == "anuncios":
        query = query.join(Consent, Consent.signature_id == Signature.id).where(
            Consent.notify_updates.is_(True), *filters
        )
    else:
        query = query.where(*filters)
    result = await db.execute(query)
    recipients: list[tuple[str, str]] = []
    for sig_id, enc, name in result.all():
        if not enc:
            continue
        try:
            email = decrypt_pii(enc, ref=str(sig_id))
        except PIIDecryptError:
            continue
        recipients.append((email, name or ""))
    return recipients


@dataclass
class CtaButton:
    text: str
    url: str
    enabled: bool = True


def _cta_block_html(ctas: list[CtaButton]) -> str:
    buttons = [c for c in ctas if c.enabled and c.text.strip() and c.url.strip()]
    if not buttons:
        return ""
    links = "".join(
        f"<a href=\"{_social_href('url', c.url)}\" target=\"_blank\" rel=\"noopener\" "
        "style=\"display:inline-block;background:#3d6b35;color:#fff;text-decoration:none;"
        "font-size:15px;font-weight:700;padding:14px 32px;border-radius:100px;margin:0 8px 8px 0;\">"
        f"{c.text.strip()}</a>"
        for c in buttons
    )
    return f"<div style='margin-top:24px;'>{links}</div>"


def build_comms_email_html(
    *,
    org_name: str,
    org_logo_url: str = "",
    heading: str,
    body_html: str,
    ctas: list[CtaButton] | None = None,
    include_social: bool = False,
    social_links: dict | None = None,
    signer_name: str = "",
) -> str:
    """Envuelve el cuerpo YA SANITIZADO (`sanitize_comms_html`) en la plantilla
    email-safe de la plataforma (R6). `body_html` no se vuelve a sanitizar acá
    — el llamador es responsable de haberlo hecho antes de persistir/enviar."""
    org_label = org_name or "Petición Cauce"
    logo_block = (
        f"<img src=\"{org_logo_url}\" alt=\"{org_label}\" width=\"48\" height=\"48\" "
        "style=\"display:block;width:48px;height:48px;object-fit:contain;border-radius:10px;margin:0 0 12px;\">"
        if org_logo_url else ""
    )
    first_name = signer_name.strip().split(" ")[0] if signer_name and signer_name.strip() else ""
    greeting = (
        f"<p style='margin:0 0 8px;font-size:16px;font-weight:700;color:#1a2516;'>Hola {first_name},</p>"
        if first_name else ""
    )
    cta_block = _cta_block_html(ctas or [])
    social_rows = _social_icon_links(social_links) if include_social else ""
    social_block = (
        "<div style='margin-top:16px;'>"
        "<p style='margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.05em;"
        "text-transform:uppercase;color:#7a8a72;'>Seguí la causa</p>"
        f"<div>{social_rows}</div></div>"
        if social_rows else ""
    )
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          {logo_block}
          <p style="margin:0 0 4px;font-size:13px;color:#7a8a72;letter-spacing:.04em;text-transform:uppercase;">{org_label}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a2516;line-height:1.2;">{heading}</h1>
          {greeting}
          <div style="font-size:15px;color:#4a5644;line-height:1.6;">
            {body_html}
          </div>
          {cta_block}
          {_powered_by_block(org_name)}
          {social_block}
        </td></tr>
      </table>
      {_PLATFORM_FOOTER_HTML}
    </td></tr>
  </table>
</body>
</html>"""
