"""Nombre simple del firmante para saludos y merge tags de los correos.

`signatures.name` es un solo campo de texto libre ("Nombre Apellido" según el
formulario), sin nombre y apellido separados: el nombre simple es la primera
palabra, saltando títulos al inicio. Separar nombre y apellido queda para una
iteración futura.
"""

_TITLES = {
    "dr", "dra", "sr", "sra", "srta", "ing", "lic", "licda", "abg", "arq",
    "mgs", "msc", "mg", "prof", "econ", "psic", "med",
}


def _capitalize(token: str) -> str:
    return "-".join(p[:1].upper() + p[1:].lower() for p in token.split("-"))


def simple_name(full_name: str | None) -> str:
    """Primera palabra del nombre, con inicial en mayúscula. "" si no hay nombre."""
    tokens = (full_name or "").split()
    if not tokens:
        return ""
    for token in tokens:
        if token.strip(".").lower() not in _TITLES:
            return _capitalize(token)
    return _capitalize(tokens[0])
