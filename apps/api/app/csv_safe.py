"""Neutraliza CSV/Excel injection en celdas de texto (hardening-campana R10).

Una celda que empieza con `=`, `+`, `-`, `@`, tab o CR se interpreta como fórmula al abrir
el archivo en Excel/Sheets. Se antepone un apóstrofo (recomendación OWASP), de modo que se
muestra como texto. Solo aplica a `str`; el resto de tipos pasa sin cambios.
"""

_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def csv_safe(value):
    if isinstance(value, str) and value.startswith(_DANGEROUS_PREFIXES):
        return "'" + value
    return value
