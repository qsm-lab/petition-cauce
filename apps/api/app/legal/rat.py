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


def render_rat(context: dict) -> str:
    return _env.get_template("rat.jinja2").render(**context)


def build_rat_context(
    campaign,
    org,
    privacy_cfg,
    aviso_versiones: list[dict],
) -> dict:
    """
    aviso_versiones: lista de dicts con {version: int, desde: str (ISO date)}
    """
    from app.config import settings

    _placeholder = "— pendiente de configurar —"

    return {
        # Responsable
        "responsable_tipo": "natural",
        "responsable_nombre": org.name,
        "responsable_cedula_ruc": getattr(org, "cedula_ruc", _placeholder),
        "responsable_domicilio": getattr(org, "domicilio", _placeholder),
        "responsable_email": getattr(org, "email", _placeholder),
        "responsable_rep": getattr(org, "rep_name", None) or _placeholder,
        # Encargado
        "encargado_tipo": settings.encargado_tipo,
        "encargado_nombre": settings.encargado_nombre or _placeholder,
        "encargado_cedula_ruc": settings.encargado_cedula_ruc or _placeholder,
        "encargado_rep_nombre": settings.encargado_rep_nombre or _placeholder,
        "encargado_domicilio": settings.encargado_domicilio or _placeholder,
        "encargado_email": settings.encargado_email or _placeholder,
        # Campaña
        "campaign_titulo": campaign.title,
        "campaign_slug": campaign.slug,
        "campaign_authority": campaign.authority or _placeholder,
        "signer_type": campaign.signer_type,
        "goal_count": campaign.goal_count or 0,
        # Retención
        "retention_days": privacy_cfg.retention_days if privacy_cfg else 365,
        "retention_label": _retention_label(privacy_cfg.retention_days if privacy_cfg else 365),
        # Versiones del aviso
        "aviso_versiones": aviso_versiones,
        # Metadatos
        "fecha_generacion": date.today().isoformat(),
    }
