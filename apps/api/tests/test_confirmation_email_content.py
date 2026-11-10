"""Contenido del correo de confirmación (revision-datos-al-firmar R1–R3, R12) y descarte de dominios reservados.

Guardia del RAT: a los proveedores de correo llega solo el primer nombre (`app/legal/subencargados.py`). El resumen de datos
(`entered_*`, derechos-arco R19) se retiró: la revisión se hace al firmar. Hotfix previo: pasar a la función un argumento que no
acepta lanza `TypeError`, se traga y no sale ningún correo de confirmación.
"""
import inspect

import pytest

from app.services import email_service

# Argumentos con los que se invoca `send_confirmation_email` desde el alta y el recuperador.
_KWARGS_DEL_LLAMADOR = {
    "to_email", "token", "campaign_title", "signer_name", "org_name", "org_logo_url", "visibility", "privacy_url",
    "org_contact_email", "arco_review_url",
}


def test_send_confirmation_email_acepta_todos_los_argumentos_del_llamador():
    assert _KWARGS_DEL_LLAMADOR <= set(inspect.signature(email_service.send_confirmation_email).parameters)


def test_ya_no_acepta_el_resumen_de_datos():
    params = set(inspect.signature(email_service.send_confirmation_email).parameters)
    assert not [p for p in params if p.startswith("entered_")]


@pytest.mark.parametrize("visibility", ["publica", "anonima", "secreta"])
async def test_el_correo_solo_lleva_el_primer_nombre(monkeypatch, _no_real_email, visibility):
    monkeypatch.setattr(email_service, "email_enabled", lambda: True)
    ok = await email_service.send_confirmation_email(
        to_email="persona@correo-real.org", token="tok", campaign_title="Yasuní", signer_name="Ana Pérez Mora",
        org_name="Colectivo Río", visibility=visibility, arco_review_url="https://app/mis-datos/portal?token=zzz",
    )
    assert ok is True and len(_no_real_email) == 1
    html = _no_real_email[0].html
    assert "Hola Ana," in html and "Corregir mis datos" in html
    for dato in ("Pérez", "Mora", "Revisa que tus datos", "Cédula", "Celular", "Ubicación", "Nombre completo"):
        assert dato not in html, dato
    assert "persona@correo-real.org" not in html
    # El listado público solo se menciona si la firma es pública
    assert ("listado público" in html) is (visibility == "publica")


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
