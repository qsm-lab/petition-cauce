"""Tests de cifrado en reposo de PII (cifrado-reposo R10)."""
import pytest
from pydantic import ValidationError

from app.config import Settings, settings
from app.crypto import PIIDecryptError, decrypt_pii, encrypt_pii


def test_roundtrip():
    original = "firmante@example.com"
    token = encrypt_pii(original)
    assert token.startswith("enc:v1:")
    assert original not in token
    assert decrypt_pii(token) == original


def test_roundtrip_cedula_y_unicode():
    for value in ("1710034065", "áéíóú ñ 🌱"):
        assert decrypt_pii(encrypt_pii(value)) == value


def test_nonce_unico_por_cifrado():
    a = encrypt_pii("mismo@example.com")
    b = encrypt_pii("mismo@example.com")
    assert a != b  # nonce aleatorio: mismo valor nunca produce el mismo token
    assert decrypt_pii(a) == decrypt_pii(b)


def test_decrypt_falla_con_clave_distinta(monkeypatch):
    token = encrypt_pii("secreto@example.com")
    otra_clave = "f" * 64
    assert otra_clave != settings.pii_encryption_key
    monkeypatch.setattr(settings, "pii_encryption_key", otra_clave)
    with pytest.raises(PIIDecryptError):
        decrypt_pii(token, ref="test")


def test_decrypt_falla_con_dato_corrupto():
    token = encrypt_pii("valor@example.com")
    corrupto = token[:-6] + "AAAAAA"
    with pytest.raises(PIIDecryptError):
        decrypt_pii(corrupto, ref="test")


def test_decrypt_rechaza_texto_sin_prefijo():
    # Tras la migración 015 no debe quedar texto legado; el fallback silencioso
    # a texto plano está prohibido por diseño (R6).
    with pytest.raises(PIIDecryptError):
        decrypt_pii("texto-plano@example.com", ref="test")


def test_error_no_expone_el_valor():
    token = encrypt_pii("sensible@example.com")
    corrupto = token[:-6] + "AAAAAA"
    try:
        decrypt_pii(corrupto, ref="sig-123")
    except PIIDecryptError as exc:
        assert "sensible" not in str(exc)
        assert "sig-123" in str(exc)


@pytest.mark.parametrize("clave", ["", "abc", "z" * 64, "a" * 63])
def test_settings_rechaza_clave_invalida(clave):
    with pytest.raises(ValidationError):
        Settings(pii_encryption_key=clave)
