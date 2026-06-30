from app.legal.retention import (
    RETENTION_CAMPANA_CORTA,
    RETENTION_CAMPANA_ESTANDAR,
    RETENTION_CAMPANA_LARGA,
    retention_label,
)
from app.legal.aviso_privacidad import build_aviso_context, render_aviso_privacidad
from app.legal.contrato_encargo import (
    build_contrato_context,
    get_contrato_dev,
    render_contrato_encargo,
)
from app.legal.rat import build_rat_context, render_rat

__all__ = [
    "RETENTION_CAMPANA_CORTA",
    "RETENTION_CAMPANA_ESTANDAR",
    "RETENTION_CAMPANA_LARGA",
    "retention_label",
    "build_aviso_context",
    "render_aviso_privacidad",
    "build_contrato_context",
    "get_contrato_dev",
    "render_contrato_encargo",
    "build_rat_context",
    "render_rat",
]
