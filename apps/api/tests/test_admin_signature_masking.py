"""Tests de masking por rol y filtro de origen — services/admin_signature_service.py."""
from app.models.signature import Signature
from app.services.admin_signature_service import _apply_provincia_filter, _visible_name


def _sig(visibility: str, name: str = "Juan Pérez") -> Signature:
    return Signature(name=name, visibility=visibility)


def test_admin_ve_nombre_de_firma_secreta():
    assert _visible_name(_sig("secreta"), role="admin") == "Juan Pérez"


def test_gestor_no_ve_nombre_de_firma_secreta():
    assert _visible_name(_sig("secreta"), role="gestor") is None


def test_gestor_si_ve_nombre_de_firma_anonima():
    assert _visible_name(_sig("anonima"), role="gestor") == "Juan Pérez"


def test_gestor_si_ve_nombre_de_firma_publica():
    assert _visible_name(_sig("publica"), role="gestor") == "Juan Pérez"


def test_admin_ve_nombre_de_cualquier_visibilidad():
    for v in ("publica", "anonima", "secreta"):
        assert _visible_name(_sig(v), role="admin") == "Juan Pérez"


def test_filtro_internacional_agrupa_paises():
    filters: list = []
    _apply_provincia_filter(filters, "internacional")
    assert len(filters) == 1
    # No es un filtro de igualdad por provincia — es un IS NOT NULL sobre country
    assert "country" in str(filters[0]).lower() or "is not" in str(filters[0]).lower()


def test_filtro_provincia_exacta_sin_cambios():
    filters: list = []
    _apply_provincia_filter(filters, "Pichincha")
    assert len(filters) == 1


def test_filtro_vacio_no_agrega_nada():
    filters: list = []
    _apply_provincia_filter(filters, None)
    _apply_provincia_filter(filters, "")
    assert filters == []
