"""Subencargados de envío de email para el RAT y el contrato de encargo.

La lista sale de la configuración (EMAIL_PROVIDER y EMAIL_POOL) para que los
documentos generados no se desactualicen al cambiar de proveedor. Todos los
proveedores operan con servidores en Estados Unidos.
"""

_PAIS = "Estados Unidos"

_PROVEEDORES = {
    "resend": {"nombre": "Resend", "seguimiento_aperturas": False},
    "brevo": {"nombre": "Brevo", "seguimiento_aperturas": True},
    "ses": {"nombre": "Amazon Web Services (Amazon SES)", "seguimiento_aperturas": False},
}

# Qué datos llegan a estos proveedores (verificado en el código): solo el email
# del destinatario y el primer nombre ("nombre simple", signer_name.simple_name)
# en el saludo de los correos y en la etiqueta <nombre> de las comunicaciones.
DATOS_COMUNICADOS = (
    "A estos proveedores llegan únicamente la dirección de correo electrónico del destinatario "
    "y su primer nombre, que se usa en el saludo del mensaje. Ningún otro dato del firmante "
    "(nombre completo, cédula, teléfono, provincia ni datos de la organización) se envía a estos "
    "proveedores."
)


def email_subencargados() -> list[dict]:
    """Proveedores de envío activos en la plataforma, en orden y sin repetir."""
    from app.config import settings

    nombres = [settings.email_provider, *settings.email_pool_list]
    vistos: list[str] = []
    for n in nombres:
        if n in _PROVEEDORES and n not in vistos:
            vistos.append(n)
    return [{**_PROVEEDORES[n], "pais": _PAIS} for n in vistos]
