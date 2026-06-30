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


def render_contrato_encargo(context: dict) -> str:
    return _env.get_template("contrato_encargo.jinja2").render(**context)


def build_contrato_context(
    org,
    campaign_scope: dict,
    validation_token: str,
    retention_days: int,
) -> dict:
    from app.config import settings

    _placeholder = "— pendiente de configurar —"

    return {
        # Responsable
        "responsable_tipo": "natural",  # campo futuro en Organization
        "responsable_nombre": org.name,
        "responsable_cedula_ruc": getattr(org, "cedula_ruc", _placeholder),
        "responsable_domicilio": getattr(org, "domicilio", _placeholder),
        "responsable_email": getattr(org, "email", _placeholder),
        "responsable_rep": getattr(org, "rep_name", None) or _placeholder,
        # Encargado (Cauce Petition)
        "encargado_tipo": settings.encargado_tipo,
        "encargado_nombre": settings.encargado_nombre or _placeholder,
        "encargado_cedula_ruc": settings.encargado_cedula_ruc or _placeholder,
        "encargado_rep_nombre": settings.encargado_rep_nombre or _placeholder,
        "encargado_domicilio": settings.encargado_domicilio or _placeholder,
        "encargado_email": settings.encargado_email or _placeholder,
        # Alcance
        "campaign_scope": campaign_scope,
        "retention_days": retention_days,
        "retention_label": _retention_label(retention_days),
        # Metadatos
        "validation_token": validation_token,
        "fecha": date.today().isoformat(),
    }


def get_contrato_dev() -> str:
    """Genera un contrato de ejemplo con datos ficticios para desarrollo.

    Solo disponible en entorno development. Úsalo en seed_dev.py para
    pre-poblar processing_contracts.content_text sin requerir config real.
    """
    from app.config import settings

    if settings.environment != "development":
        raise RuntimeError("get_contrato_dev() solo disponible en entorno development")

    context = {
        "responsable_tipo": "natural",
        "responsable_nombre": "María Elena Vásquez Moreno",
        "responsable_cedula_ruc": "1712345678",
        "responsable_domicilio": "Quito, Pichincha, Ecuador",
        "responsable_email": "mvasquez@cauce-ecuador-dev.example",
        "responsable_rep": None,
        "encargado_tipo": "natural",
        "encargado_nombre": settings.encargado_nombre or "Andrés Guamán (DEV)",
        "encargado_cedula_ruc": settings.encargado_cedula_ruc or "1798765432",
        "encargado_rep_nombre": "",
        "encargado_domicilio": settings.encargado_domicilio or "Quito, Ecuador",
        "encargado_email": settings.encargado_email or "dev@cauce-petition.example",
        "campaign_scope": {
            "authority": "Asamblea Nacional del Ecuador",
            "signer_types_label": "personas naturales y organizaciones",
            "data_categories_label": "nombre, cédula (cifrada), correo electrónico (cifrado), provincia",
        },
        "retention_days": 365,
        "retention_label": _retention_label(365),
        "validation_token": "CONTRATO-DEV-001",
        "fecha": date.today().isoformat(),
    }
    return render_contrato_encargo(context)
