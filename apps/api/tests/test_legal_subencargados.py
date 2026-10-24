"""RAT y contrato de encargo listan los subencargados de envío de email
(docs/legal/subencargados_email.md)."""
from types import SimpleNamespace

from app.config import settings
from app.legal.contrato_encargo import build_contrato_context, render_contrato_encargo
from app.legal.rat import build_rat_context, render_rat
from app.legal.subencargados import email_subencargados


def _rat(monkeypatch, provider="resend", pool=""):
    monkeypatch.setattr(settings, "email_provider", provider)
    monkeypatch.setattr(settings, "email_pool", pool)
    org = SimpleNamespace(name="Org", cedula_ruc="1", domicilio="Quito", email="o@x.ec", rep_name=None)
    camp = SimpleNamespace(title="C", slug="c", authority="Asamblea", signer_type="natural", goal_count=10)
    return render_rat(build_rat_context(camp, org, None, [{"version": 1, "desde": "2026-01-01"}]))


def test_lista_sin_repetidos_y_en_orden(monkeypatch):
    monkeypatch.setattr(settings, "email_provider", "resend")
    monkeypatch.setattr(settings, "email_pool", "brevo,resend")
    assert [s["nombre"] for s in email_subencargados()] == ["Resend", "Brevo"]


def test_rat_solo_resend(monkeypatch):
    txt = _rat(monkeypatch)
    assert "Resend — servidores en Estados Unidos" in txt
    assert "Brevo" not in txt
    assert "seguimiento de aperturas" not in txt
    assert "No se realizan transferencias de datos personales a terceros países" not in txt
    assert "pendiente" not in txt.split("6. DESTINATARIOS")[1].split("8. PLAZOS")[0]


def test_rat_con_pool_incluye_brevo_y_aperturas(monkeypatch):
    txt = _rat(monkeypatch, pool="brevo,resend")
    assert "Brevo — servidores en Estados Unidos" in txt
    assert "seguimiento de aperturas" in txt
    assert "su primer nombre" in txt
    assert "Ningún otro dato del firmante" in txt


def test_contrato_autoriza_subencargados(monkeypatch):
    monkeypatch.setattr(settings, "email_provider", "resend")
    monkeypatch.setattr(settings, "email_pool", "brevo,resend")
    org = SimpleNamespace(name="Org", cedula_ruc="1", domicilio="Quito", email="o@x.ec", rep_name=None)
    ctx = build_contrato_context(org, {"authority": "A", "signer_types_label": "s", "data_categories_label": "d"}, "T", 365)
    txt = render_contrato_encargo(ctx)
    assert "autoriza al Encargado a utilizar los" in txt
    assert "Resend — servidores en Estados Unidos" in txt
    assert "Brevo — servidores en Estados Unidos" in txt
