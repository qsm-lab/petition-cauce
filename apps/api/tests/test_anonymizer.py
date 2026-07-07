"""Tests del helper de enmascaramiento — services/anonymizer.py."""
from app.services.anonymizer import anonymize_answers


def test_email_enmascarado():
    assert anonymize_answers("firmante@example.com") == "fi***@example.com"


def test_email_local_corto():
    assert anonymize_answers("a@example.com") == "a***@example.com"


def test_texto_largo_enmascarado():
    assert anonymize_answers("Juan Pérez") == "Jua***"


def test_texto_corto_totalmente_enmascarado():
    assert anonymize_answers("Ana") == "***"


def test_none_y_vacio_pasan_intactos():
    assert anonymize_answers(None) is None
    assert anonymize_answers("") == ""


def test_valor_original_no_aparece_completo():
    original = "cedula1710034065"
    masked = anonymize_answers(original)
    assert original not in masked
