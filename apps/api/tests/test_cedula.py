"""Suite de validacion-cedula (R7): verify_cedula módulo-10."""
import pytest

from app.crypto import verify_cedula

# Cédulas matemáticamente válidas (dígito verificador calculado, provincias variadas)
VALIDAS = [
    "1710034065",  # Pichincha (17)
    "0102030400",  # Azuay (01)
    "2401020306",  # Santa Elena (24, límite superior)
    "3001020308",  # Registrados en el exterior (30)
    "0905040309",  # Guayas (09)
    "1302010200",  # Manabí (13)
]


@pytest.mark.parametrize("cedula", VALIDAS)
def test_cedulas_validas(cedula):
    assert verify_cedula(cedula) is True


@pytest.mark.parametrize("cedula", VALIDAS)
def test_digito_verificador_incorrecto(cedula):
    # Alterar el último dígito invalida la cédula
    wrong = cedula[:9] + str((int(cedula[9]) + 1) % 10)
    assert verify_cedula(wrong) is False


@pytest.mark.parametrize("cedula", [
    "171003406",     # 9 dígitos
    "17100340655",   # 11 dígitos
    "",              # vacía
    "17100A4065",    # no numérica
    "1710-034065",   # con guion
])
def test_formato_invalido(cedula):
    assert verify_cedula(cedula) is False


@pytest.mark.parametrize("cedula", [
    "0010034060",  # provincia 00
    "2510034060",  # provincia 25 (fuera de rango)
    "2910034060",  # provincia 29
    "3110034060",  # provincia 31
    "9910034060",  # provincia 99
])
def test_provincia_fuera_de_rango(cedula):
    assert verify_cedula(cedula) is False


def test_provincia_30_exterior_es_valida():
    assert verify_cedula("3001020308") is True


@pytest.mark.parametrize("tercer_digito", ["6", "7", "8", "9"])
def test_tercer_digito_sociedades_rechazado(tercer_digito):
    # Tercer dígito >= 6 corresponde a sociedades/RUC, no a personas naturales.
    # Se construye con verificador correcto para aislar la regla del tercer dígito.
    base = "17" + tercer_digito + "003406"
    coef = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    total = sum(v - 9 if (v := int(base[i]) * c) >= 10 else v for i, c in enumerate(coef))
    cedula = base + str((10 - (total % 10)) % 10)
    assert verify_cedula(cedula) is False


def test_trim_de_espacios():
    assert verify_cedula("  1710034065  ") is True
