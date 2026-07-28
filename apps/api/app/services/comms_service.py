"""Centro de comunicaciones: sanitización de contenido, segmentación de
destinatarios por clase LOPDP y armado del HTML final del envío.

No define transporte ni credenciales propias — el remitente y el proveedor
los resuelve `config-email-org` (D3, R16). El "editor WYSIWYG" produce HTML
libre que SIEMPRE se sanitiza (R6) antes de envolverse en la plantilla
email-safe de la plataforma.
"""
from __future__ import annotations

import html as _html_mod
import os
import re
import uuid
from dataclasses import dataclass, field
from typing import Callable

import nh3
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crypto import PIIDecryptError, decrypt_pii
from app.models.comms_upload import CommsUpload
from app.models.consent import Consent
from app.models.signature import Signature
from app.services.admin_signature_service import _mask_cedula, _mask_email, _mask_phone
from app.services.email_service import (
    _platform_footer_html,
    _powered_by_block,
    _social_href,
    _social_icon_links,
)
from app.services.signature_service import unsubscribe_token

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
    "p": {"style"},
    "h1": {"style"},
    "h2": {"style"},
    "h3": {"style"},
}
_TEXT_ALIGN_RE = re.compile(r"^\s*text-align\s*:\s*(left|center|right)\s*;?\s*$", re.IGNORECASE)
# Ancho estándar de la industria para HTML email (Litmus/Campaign Monitor/
# Mailchimp): 600px es el más ampliamente soportado sin scroll horizontal en
# clientes de escritorio, y se reduce bien en mobile con `max-width:100%` en
# las imágenes.
_EMAIL_WIDTH_PX = 600
_IMG_SAFE_STYLE = "max-width:100%;height:auto;display:block;border-radius:8px;margin:8px 0;"


def _uploads_origin() -> str:
    # settings.api_public_url ya incluye el prefijo /api que nginx proxea
    # hacia la API en el mismo dominio público (infra/nginx/*.conf) — las
    # imágenes deben resolver contra ESE origen (el que las sirve), no el del
    # frontend Next.js.
    return (settings.api_public_url or "").rstrip("/")


def _restrict_img_src(tag: str, attr: str, value: str) -> str | None:
    """R6: img@src solo puede apuntar al dominio de uploads de la plataforma
    (evita hotlink a terceros / tracking pixels no deseados en el editor).
    `style` en p/h1/h2/h3 solo se permite si es EXACTAMENTE `text-align:
    left|center|right` (alineación de texto) — cualquier otro valor se
    descarta entero, sin superficie de inyección de CSS."""
    if tag == "img" and attr == "src":
        origin = _uploads_origin()
        if not origin or not value.startswith(origin):
            return None
        return value
    if tag in ("p", "h1", "h2", "h3") and attr == "style":
        m = _TEXT_ALIGN_RE.match(value)
        return f"text-align:{m.group(1).lower()};" if m else None
    return value


_IMG_TAG_RE = re.compile(r"<img\b[^>]*>")
_IMG_STYLE_ATTR_RE = re.compile(r'\s+style="[^"]*"')


def _force_img_style(html: str) -> str:
    """`style` no está en la allowlist de nh3 (se descarta al sanitizar) —
    se reinyecta acá con un valor FIJO conocido, ignorando cualquier CSS que
    haya puesto el autor (editor visual o vista Código): esto cubre todas
    las imágenes por igual (no depende de que TipTap las haya insertado con
    un style previo) sin abrir ninguna superficie de inyección de CSS, ya
    que el valor nunca proviene del contenido del usuario."""
    def _inject(match: re.Match) -> str:
        tag = _IMG_STYLE_ATTR_RE.sub("", match.group(0))
        return tag[:-1] + f' style="{_IMG_SAFE_STYLE}">'
    return _IMG_TAG_RE.sub(_inject, html)


def sanitize_comms_html(html: str) -> str:
    """R6: sanitiza el HTML del editor contra una allowlist explícita antes de
    guardarse o enviarse — nunca se envía HTML crudo del admin."""
    if not html:
        return ""
    cleaned = nh3.clean(
        html,
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRIBUTES,
        attribute_filter=_restrict_img_src,
        url_schemes={"http", "https", "mailto"},
        link_rel="noopener noreferrer",
    )
    return _force_img_style(cleaned)


# ── Uploads de imágenes del editor (Fase 2, R4/R19) ──────────────────────────
# Sniffing por firma de bytes (magic numbers) en vez de una librería de MIME
# genérica (python-magic requiere libmagic del sistema; el contenedor no tenía
# salida a internet para instalar dependencias nuevas durante esta sesión) —
# alcanza porque solo se aceptan estos 4 formatos exactos; cualquier otro tipo
# (incluido SVG, que es texto/XML) simplemente no matchea ninguna firma.
_IMAGE_SIGNATURES: list[tuple[str, str, Callable[[bytes], bool]]] = [
    ("jpg", "image/jpeg", lambda d: d[:3] == b"\xff\xd8\xff"),
    ("png", "image/png", lambda d: d[:8] == b"\x89PNG\r\n\x1a\n"),
    ("gif", "image/gif", lambda d: d[:6] in (b"GIF87a", b"GIF89a")),
    ("webp", "image/webp", lambda d: d[:4] == b"RIFF" and d[8:12] == b"WEBP"),
]


def sniff_image(data: bytes) -> tuple[str, str] | None:
    """Detecta el formato real por firma de bytes. Devuelve (extensión, mime)
    o None si no matchea ninguno de los 4 formatos permitidos (R19: SVG y
    cualquier otro tipo quedan rechazados por no tener firma reconocida)."""
    for ext, mime, matches in _IMAGE_SIGNATURES:
        if matches(data):
            return ext, mime
    return None


class UploadRejected(ValueError):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


async def save_comms_upload(
    db: AsyncSession, *, org_id: uuid.UUID, campaign_id: uuid.UUID, data: bytes, created_by: uuid.UUID | None,
) -> CommsUpload:
    """Valida tamaño/tipo (R19) y guarda el binario en el volumen del VPS bajo
    `<org_id>/<campaign_id>/<uuid>.<ext>` (D2) — nombre no adivinable. El
    binario se escribe sincrónicamente: son archivos chicos (≤25MB) y no hay
    volumen de tráfico concurrente que justifique aiofiles (dependencia nueva
    evitable)."""
    if len(data) > settings.comms_upload_max_bytes:
        raise UploadRejected("too_large")
    sniffed = sniff_image(data)
    if sniffed is None:
        raise UploadRejected("invalid_type")
    ext, mime = sniffed

    rel_dir = os.path.join(str(org_id), str(campaign_id))
    filename = f"{uuid.uuid4()}.{ext}"
    rel_path = os.path.join(rel_dir, filename)
    abs_dir = os.path.join(settings.uploads_dir, rel_dir)
    os.makedirs(abs_dir, exist_ok=True)
    with open(os.path.join(abs_dir, filename), "wb") as f:
        f.write(data)

    upload = CommsUpload(
        org_id=org_id, campaign_id=campaign_id, path=rel_path.replace(os.sep, "/"),
        mime=mime, bytes=len(data), created_by=created_by,
    )
    db.add(upload)
    await db.commit()
    # Sin refresh(): id/path ya están seteados en Python antes del insert y
    # created_at llega poblado por el RETURNING implícito del INSERT
    # (SQLAlchemy 2.x + asyncpg). Un refresh() posterior dispara una SELECT
    # bajo RLS que puede fallar en producción si el pool de conexiones
    # devuelve una conexión física distinta a la que tenía seteado el GUC de
    # sesión app.current_org_id tras el commit — nadie consume created_at
    # aquí, así que la consulta extra es puro riesgo sin beneficio.
    return upload


def comms_upload_url(upload: CommsUpload) -> str:
    return f"{_uploads_origin()}/media/{upload.path}"


def unsubscribe_url_for(signature_id: uuid.UUID) -> str:
    """R20: link de desuscripción de un clic para el footer de la clase
    Anuncios — servido por la API misma (endpoint público, sin auth)."""
    origin = _uploads_origin()  # settings.api_public_url, mismo origen que /media
    token = unsubscribe_token(signature_id)
    return f"{origin}/v1/public-campaign/signatures/{signature_id}/unsubscribe?token={token}"


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


async def get_recipient_ids(
    db: AsyncSession, campaign_id: uuid.UUID, comms_type: str, audience: AudienceFilter
) -> list[uuid.UUID]:
    """IDs de `signatures` del segmento — usado por la cola (Fase 3) para
    trocear en lotes sin persistir PII en `send_batch`; el email se descifra
    recién al procesar cada lote (`get_recipients_by_ids`)."""
    filters, clase = build_segment_filters(campaign_id, comms_type, audience)
    query = select(Signature.id)
    if clase == "anuncios":
        query = query.join(Consent, Consent.signature_id == Signature.id).where(
            Consent.notify_updates.is_(True), *filters
        )
    else:
        query = query.where(*filters)
    result = await db.execute(query)
    return [row[0] for row in result.all()]


async def get_recipients_by_ids(db: AsyncSession, ids: list[uuid.UUID]) -> list[tuple[str, str, uuid.UUID]]:
    """(email, nombre, signature_id) descifrados para un lote ya trozado por
    ID — no vuelve a aplicar el segmento (los IDs ya lo cumplían al
    resolverse)."""
    if not ids:
        return []
    query = select(Signature.id, Signature.email_encrypted, Signature.name).where(Signature.id.in_(ids))
    result = await db.execute(query)
    recipients: list[tuple[str, str, uuid.UUID]] = []
    for sig_id, enc, name in result.all():
        if not enc:
            continue
        try:
            email = decrypt_pii(enc, ref=str(sig_id))
        except PIIDecryptError:
            continue
        recipients.append((email, name or "", sig_id))
    return recipients


async def get_recipients(
    db: AsyncSession, campaign_id: uuid.UUID, comms_type: str, audience: AudienceFilter
) -> list[tuple[str, str]]:
    """(email, nombre) descifrados del segmento — nunca expone PII de
    firmas secretas (fuera del universo posible) ni de archivadas."""
    ids = await get_recipient_ids(db, campaign_id, comms_type, audience)
    triples = await get_recipients_by_ids(db, ids)
    return [(email, name) for email, name, _sid in triples]


@dataclass
class RecipientData:
    """Datos crudos (algunos aún cifrados) de un destinatario — suficiente
    para armar el `MergeContext` (`build_merge_context`) sin descifrar nada
    que el mensaje no vaya a usar."""
    signature_id: uuid.UUID
    email: str
    name: str
    cedula_encrypted: str | None
    celular_encrypted: str | None
    provincia: str | None
    country: str | None
    org_name: str | None
    signer_type: str


async def get_recipient_data_by_ids(db: AsyncSession, ids: list[uuid.UUID]) -> list[RecipientData]:
    """Como `get_recipients_by_ids` pero trae también lo necesario para los
    merge tags del cuerpo (cédula/teléfono/provincia/organización)."""
    if not ids:
        return []
    result = await db.execute(select(Signature).where(Signature.id.in_(ids)))
    recipients: list[RecipientData] = []
    for sig in result.scalars().all():
        if not sig.email_encrypted:
            continue
        try:
            email = decrypt_pii(sig.email_encrypted, ref=str(sig.id))
        except PIIDecryptError:
            continue
        recipients.append(RecipientData(
            signature_id=sig.id, email=email, name=sig.name or "",
            cedula_encrypted=sig.cedula_encrypted, celular_encrypted=sig.celular_encrypted,
            provincia=sig.provincia, country=sig.country, org_name=sig.org_name, signer_type=sig.signer_type,
        ))
    return recipients


@dataclass
class MergeContext:
    """Valores de sustitución para los merge tags `<tag>` del contenido
    general. Cédula/email/teléfono llegan YA enmascarados (mismo patrón que
    la descarga normal de firmas — `_mask_cedula`/`_mask_email`/
    `_mask_phone` de `admin_signature_service`, reusados acá, no
    duplicados) — el email nunca sale con PII sin enmascarar más allá de lo
    que el destinatario ya sabe de sí mismo."""
    nombre: str = ""
    nombre_completo: str = ""
    cedula: str = ""
    email: str = ""
    telefono: str = ""
    provincia: str = ""
    organizacion: str = ""


SAMPLE_MERGE_CONTEXT = MergeContext(
    nombre="Nombre", nombre_completo="Nombre Apellido", cedula="17XXXXX601",
    email="nomXXXXXXX@ejemplo.com", telefono="XXXXXX4321", provincia="Pichincha",
    organizacion="Organización de ejemplo",
)


def build_merge_context(r: RecipientData) -> MergeContext:
    first = r.name.strip().split(" ")[0] if r.name and r.name.strip() else ""
    cedula = ""
    if r.cedula_encrypted:
        try:
            cedula = _mask_cedula(decrypt_pii(r.cedula_encrypted, ref=str(r.signature_id)))
        except PIIDecryptError:
            cedula = ""
    telefono = ""
    if r.celular_encrypted:
        try:
            telefono = _mask_phone(decrypt_pii(r.celular_encrypted, ref=str(r.signature_id)))
        except PIIDecryptError:
            telefono = ""
    return MergeContext(
        nombre=first, nombre_completo=r.name or "", cedula=cedula,
        email=_mask_email(r.email) if r.email else "", telefono=telefono,
        provincia=r.provincia or r.country or "",
        organizacion=(r.org_name or "") if r.signer_type == "org" else "",
    )


_MERGE_TAG_ALIASES = {
    "nombre completo": "nombre_completo",
    "nombre": "nombre",
    "cedula": "cedula", "cédula": "cedula",
    "email": "email", "correo": "email",
    "telefono": "telefono", "teléfono": "telefono",
    "provincia": "provincia",
    "organizacion": "organizacion", "organización": "organizacion",
}
# Cubre tanto <tag> literal (vista Código) como &lt;tag&gt; — lo que produce
# el editor visual al serializar texto plano tipeado (TipTap escapa los
# nodos de texto; nh3 interpretaría un <tag> real como una etiqueta HTML
# desconocida y la descartaría, por eso el admin escribe el tag como texto
# normal, no como markup).
_MERGE_TAG_RE = re.compile(
    r"(?:&lt;|<)\s*(nombre completo|nombre|cedula|c[ée]dula|email|correo|tel[ée]fono|telefono|provincia|"
    r"organizaci[oó]n)\s*(?:&gt;|>)",
    re.IGNORECASE,
)


def render_merge_tags(body_html: str, ctx: MergeContext) -> str:
    """Sustituye los tags `<nombre>`, `<cedula>`, etc. por el dato del
    destinatario. Corre DESPUÉS de `sanitize_comms_html` y una vez por
    destinatario — los valores se escapan (`html.escape`) antes de insertarse,
    así que ni el nombre de un firmante puede inyectar HTML en el email."""
    values = {
        "nombre": ctx.nombre, "nombre_completo": ctx.nombre_completo, "cedula": ctx.cedula,
        "email": ctx.email, "telefono": ctx.telefono, "provincia": ctx.provincia,
        "organizacion": ctx.organizacion,
    }

    def _repl(m: re.Match) -> str:
        key = _MERGE_TAG_ALIASES.get(m.group(1).lower().strip())
        value = values.get(key or "", "")
        return _html_mod.escape(value) if value else "—"

    return _MERGE_TAG_RE.sub(_repl, body_html)


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
        "font-size:15px;font-weight:700;padding:14px 32px;border-radius:100px;margin:0 8px 8px;\">"
        f"{c.text.strip()}</a>"
        for c in buttons
    )
    return f"<div style='margin-top:24px;text-align:center;'>{links}</div>"


def build_comms_email_html(
    *,
    org_name: str,
    org_logo_url: str = "",
    heading: str,
    body_html: str,
    ctas: list[CtaButton] | None = None,
    include_social: bool = False,
    social_links: dict | None = None,
    unsubscribe_url: str | None = None,
) -> str:
    """Envuelve el cuerpo YA SANITIZADO (`sanitize_comms_html`) en la plantilla
    email-safe de la plataforma (R6). `body_html` no se vuelve a sanitizar acá
    — el llamador es responsable de haberlo hecho antes de persistir/enviar.
    Sin saludo fijo: la personalización (nombre, etc.) la controla el admin
    con los merge tags `<tag>` directamente en el cuerpo (`render_merge_tags`).

    Marca de plataforma ("+CAUCES") vs. marca de la campaña (`org_name`) son
    dos cosas distintas: la primera es un badge FIJO fuera de la tarjeta
    (arriba, quién opera la plataforma); la segunda es "Impulsado por" al pie
    de la tarjeta (la organización dueña de ESTA campaña, dinámica)."""
    logo_block = (
        f"<img src=\"{org_logo_url}\" alt=\"{org_name}\" width=\"48\" height=\"48\" "
        "style=\"display:block;width:48px;height:48px;object-fit:contain;border-radius:10px;margin:0 0 12px;\">"
        if org_logo_url else ""
    )
    cta_block = _cta_block_html(ctas or [])
    social_rows = _social_icon_links(social_links) if include_social else ""
    social_block = (
        "<div style='margin-top:16px;text-align:center;'>"
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
      <table width="100%" style="max-width:{_EMAIL_WIDTH_PX}px;">
        <tr><td style="padding:0 6px 10px;text-align:right;">
          <span style="font-family:'Anton',Impact,sans-serif;font-size:12px;font-weight:700;letter-spacing:.03em;color:#7a8a72;">+CAUCES</span>
        </td></tr>
        <tr><td style="background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
          {logo_block}
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a2516;line-height:1.2;">{heading}</h1>
          <div style="font-size:15px;color:#4a5644;line-height:1.6;">
            {body_html}
          </div>
          {cta_block}
          {_powered_by_block(org_name)}
          {social_block}
        </td></tr>
      </table>
      {_platform_footer_html(unsubscribe_url)}
    </td></tr>
  </table>
</body>
</html>"""
