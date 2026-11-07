"""hardening-campana R10: las exportaciones no inyectan fórmulas."""
import pytest

from app.csv_safe import csv_safe


@pytest.mark.parametrize("peligroso", [
    "=HYPERLINK(\"http://x\")", "+cmd|' /C calc'!A0", "-2+3", "@SUM(1+1)", "\tabc", "\rabc",
])
def test_neutraliza_prefijos_de_formula(peligroso):
    assert csv_safe(peligroso) == "'" + peligroso


@pytest.mark.parametrize("seguro", ["Ana Pérez", "ana@correo.ec", "1712345678", "", "Quito"])
def test_deja_intacto_el_texto_normal(seguro):
    assert csv_safe(seguro) == seguro


def test_no_toca_tipos_no_texto():
    assert csv_safe(None) is None
    assert csv_safe(12) == 12
