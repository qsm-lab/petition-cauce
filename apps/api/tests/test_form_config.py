"""Tests del merge de form_config por campaña — signature_service._get_form_config."""
from types import SimpleNamespace

from app.services.signature_service import _get_form_config, _DEFAULT_FORM_CONFIG


def _campaign(meta):
    return SimpleNamespace(meta=meta)


def test_sin_meta_usa_defaults():
    cfg = _get_form_config(_campaign(None))
    assert cfg == _DEFAULT_FORM_CONFIG


def test_meta_vacia_usa_defaults():
    cfg = _get_form_config(_campaign({}))
    assert cfg == _DEFAULT_FORM_CONFIG


def test_override_parcial_conserva_el_resto():
    cfg = _get_form_config(_campaign({"form_config": {"required_fields": ["nombre", "email"]}}))
    assert cfg["required_fields"] == ["nombre", "email"]
    assert cfg["signer_types"] == _DEFAULT_FORM_CONFIG["signer_types"]
    assert cfg["visibility_options"] == _DEFAULT_FORM_CONFIG["visibility_options"]


def test_override_completo():
    custom = {
        "signer_types": ["natural", "juridica"],
        "location_modes": ["nacional", "internacional"],
        "required_fields": ["email"],
        "visibility_options": ["publica", "anonima", "secreta"],
        "request_celular": True,
    }
    cfg = _get_form_config(_campaign({"form_config": custom}))
    assert cfg == custom
