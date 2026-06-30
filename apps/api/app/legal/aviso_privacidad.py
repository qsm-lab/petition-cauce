from datetime import date
from pathlib import Path

import jinja2

from app.legal.retention import retention_label as _retention_label

_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(str(Path(__file__).parent / "templates")),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)


def render_aviso_privacidad(context: dict) -> str:
    return _env.get_template("aviso_privacidad.jinja2").render(**context)


def build_aviso_context(
    campaign,
    org,
    retention_days: int,
    data_contact_email: str | None,
    data_contact_nombre: str | None,
    aviso_version: int = 1,
) -> dict:
    from app.config import settings

    _placeholder = "— pendiente de configurar —"

    return {
        # Responsable — siempre "natural" hasta que Organization tenga campo tipo_entidad
        "responsable_tipo": "natural",
        "responsable_nombre": org.name,
        "responsable_cedula_ruc": getattr(org, "cedula_ruc", _placeholder),
        "responsable_domicilio": getattr(org, "domicilio", _placeholder),
        "responsable_email": data_contact_email or _placeholder,
        "responsable_rep": getattr(org, "rep_name", None) or _placeholder,
        # Encargado (Cauce Petition)
        "encargado_tipo": settings.encargado_tipo,
        "encargado_nombre": settings.encargado_nombre or _placeholder,
        "encargado_cedula_ruc": settings.encargado_cedula_ruc or _placeholder,
        "encargado_rep_nombre": settings.encargado_rep_nombre or _placeholder,
        "encargado_domicilio": settings.encargado_domicilio or _placeholder,
        "encargado_email": settings.encargado_email or _placeholder,
        # Campaña
        "campaign_titulo": campaign.title,
        "campaign_authority": campaign.authority or _placeholder,
        "signer_type": campaign.signer_type,
        # Retención
        "retention_days": retention_days,
        "retention_label": _retention_label(retention_days),
        # Contacto titular
        "data_contact_nombre": data_contact_nombre or _placeholder,
        "data_contact_email": data_contact_email or _placeholder,
        # Versión y fecha
        "aviso_version": aviso_version,
        "fecha_vigencia": date.today().isoformat(),
    }
