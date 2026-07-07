"""Tests de HMAC para PII (email, cédula, IP) — app/crypto.py."""
from app.crypto import hmac_sha256, compute_hmac


def test_hmac_es_determinista():
    assert hmac_sha256("test@example.com", "clave") == hmac_sha256("test@example.com", "clave")


def test_hmac_distingue_valores():
    assert hmac_sha256("a@example.com", "clave") != hmac_sha256("b@example.com", "clave")


def test_hmac_distingue_claves():
    # Claves distintas (p. ej. petition-cauce vs forms-qsm) no producen hashes correlacionables
    assert hmac_sha256("test@example.com", "clave-1") != hmac_sha256("test@example.com", "clave-2")


def test_hmac_formato_hex_sha256():
    digest = hmac_sha256("valor", "clave")
    assert len(digest) == 64
    int(digest, 16)  # no lanza: es hex válido


def test_compute_hmac_usa_clave_de_settings():
    # Mismo valor → mismo hash dentro del proceso (clave estable de settings)
    assert compute_hmac("test@example.com") == compute_hmac("test@example.com")
    assert compute_hmac("test@example.com") != compute_hmac("otro@example.com")


def test_hmac_no_expone_valor():
    email = "firmante@example.com"
    assert email not in hmac_sha256(email, "clave")
