"""Contenido del correo de confirmación (derechos-arco R19) y descarte de dominios reservados.

Hotfix: `create_signature` pasaba `entered_*` y `arco_review_url` a una función que no los aceptaba
(`TypeError` tragado) y no salía ningún correo de confirmación.
"""
import inspect

import pytest

from app.services import email_service

# Argumentos con los que se invoca `send_confirmation_email` desde el alta y el recuperador.
_KWARGS_DEL_LLAMADOR = {
    "to_email", "token", "campaign_title", "signer_name", "org_name", "org_logo_url", "visibility", "privacy_url",
    "org_contact_email", "entered_name", "entered_cedula_masked", "entered_org_name", "entered_location",
    "entered_celular_masked", "arco_review_url",
}


def test_send_confirmation_email_acepta_todos_los_argumentos_del_llamador():
    assert _KWARGS_DEL_LLAMADOR <= set(inspect.signature(email_service.send_confirmation_email).parameters)


async def test_el_correo_real_incluye_resumen_sin_el_correo_del_firmante(monkeypatch, _no_real_email):
    monkeypatch.setattr(email_service, "email_enabled", lambda: True)
    ok = await email_service.send_confirmation_email(
        to_email="persona@correo-real.org", token="tok", campaign_title="Yasuní", signer_name="Ana Pérez",
        entered_name="Ana <b>Pérez</b>", entered_cedula_masked="17XXXXX065", entered_location="Pichincha",
        arco_review_url="https://app/mis-datos/portal?token=zzz",
    )
    assert ok is True and len(_no_real_email) == 1
    html = _no_real_email[0].html
    assert "17XXXXX065" in html and "Pichincha" in html and "Corregir mis datos" in html
    assert "Ana &lt;b&gt;Pérez&lt;/b&gt;" in html and "<b>Pérez</b>" not in html  # se escapa
    assert "persona@correo-real.org" not in html


@pytest.mark.parametrize("dir_,reservada", [
    ("a@firmante.test", True), ("a@x.local", True), ("a@example.com", True), ("a@sub.example.org", False),
    ("a@gmail.com", False), ("a@mail.invalid", True),
])
def test_dominios_reservados(dir_, reservada):
    assert email_service.is_undeliverable_domain(dir_) is reservada


async def test_dominio_reservado_no_llama_al_proveedor(monkeypatch, _no_real_email):
    monkeypatch.setattr(email_service, "email_enabled", lambda: True)
    assert await email_service.send_confirmation_email(to_email="x@firmante.test", token="t", campaign_title="c") is True
    assert _no_real_email == []
