import hashlib
import re


def anonymize_answers(value: str | None) -> str | None:
    if not value:
        return value
    if "@" in value:
        parts = value.split("@")
        local = parts[0]
        domain = parts[1] if len(parts) > 1 else ""
        return f"{local[:2]}***@{domain}"
    return f"{value[:3]}***" if len(value) > 3 else "***"
