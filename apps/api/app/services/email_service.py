import html as _html
import logging
import re
from datetime import timedelta, timezone
from typing import Sequence
from urllib.parse import quote
from zoneinfo import ZoneInfo

import httpx

from app.config import settings
from app.services.email_transport import EmailMessage, EmailTransport, platform_transport

logger = logging.getLogger(__name__)

# Los formularios de comunicación capturan la hora en horario local de
# Ecuador (siempre continental, sin horario de verano) — el datetime llega
# al backend ya convertido a UTC por el navegador; hay que revertir la
# conversión para mostrar la hora que el admin realmente cargó.
_TZ_EC = ZoneInfo("America/Guayaquil")

_CONFIRM_PATH = "/v1/public-campaign/confirm/"

# Mismo texto del footer de la plataforma — transparencia en cada email (2.4)
_PLATFORM_FOOTER_HTML = (
    "<p style='margin:16px 0 0;font-size:11px;color:#9aaa92;text-align:center;line-height:1.5;'>"
    "Plataforma sin fines de lucro hecha en Ecuador · +Cauces · Todos los derechos reservados 2026"
    "</p>"
)

# Qué implica cada visibilidad — reiterado en el email de confirmación (LOPDP)
_VISIBILITY_EXPLANATIONS = {
    "publica": (
        "Elegiste firma <strong>pública</strong>: tu nombre aparecerá en el listado "
        "público de apoyos y en el documento de entrega de la campaña."
    ),
    "anonima": (
        "Elegiste firma <strong>anónima</strong>: tu firma se suma al conteo y al "
        "documento de entrega, pero tu nombre no se muestra públicamente."
    ),
    "secreta": (
        "Elegiste firma <strong>secreta</strong>: tu firma solo se suma al conteo. "
        "No se muestra públicamente ni se incluirá en el documento de la campaña "
        "cuando su finalidad sea la entrega oficial de firmas a una autoridad, "
        "ente del Estado o entidad privada."
    ),
}


def _signer_action_html(
    *,
    heading: str,
    body_html: str,
    cta_label: str,
    cta_url: str,
    footer: str,
    signer_name: str = "",
    org_name: str = "",
    org_logo_url: str = "",
) -> str:
    """Plantilla base de emails al firmante: logo de la organización, saludo por nombre y CTA."""
    first_name = signer_name.strip().split(" ")[0] if signer_name and signer_name.strip() else ""
    greeting = f"<p style='margin:0 0 8px;font-size:16px;font-weight:700;color:#1a2516;'>Hola {first_name},</p>" if first_name else ""
    logo_block = (
        f"<img src=\"{org_logo_url}\" alt=\"{org_name or 'Organización'}\" width=\"48\" height=\"48\" "
        f"style=\"display:block;width:48px;height:48px;object-fit:contain;border-radius:10px;margin:0 0 12px;\">"
        if org_logo_url else ""
    )
    org_label = org_name or "Petición Cauce"
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          {logo_block}
          <p style="margin:0 0 4px;font-size:13px;color:#7a8a72;letter-spacing:.04em;text-transform:uppercase;">{org_label}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a2516;line-height:1.2;">{heading}</h1>
          {greeting}
          <p style="margin:0 0 24px;font-size:15px;color:#4a5644;line-height:1.6;">
            {body_html}
          </p>
          <a href="{cta_url}"
             style="display:inline-block;background:#3d6b35;color:#fff;text-decoration:none;
                    font-size:15px;font-weight:700;padding:14px 32px;border-radius:100px;">
            {cta_label}
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#9aaa92;line-height:1.5;">
            {footer}
          </p>
        </td></tr>
      </table>
      {_PLATFORM_FOOTER_HTML}
    </td></tr>
  </table>
</body>
</html>"""


_STAGE_NAMES = ["Lanzada", "Recolección", "Entrega", "Diálogo", "Decisión"]


async def _send(
    to: str | Sequence[str],
    subject: str,
    html: str,
    *,
    transport: "EmailTransport | None" = None,
    from_: str | None = None,
    reply_to: str | None = None,
) -> bool:
    """Envía un email a través del transporte resuelto (config-email-org). Sin
    `transport` usa el de plataforma (Resend global) — retrocompat con todos los
    llamadores existentes. `from_`/`reply_to` permiten el remitente por campaña."""
    recipients = [to] if isinstance(to, str) else list(to)
    if not recipients:
        return False
    tr = transport or platform_transport()
    msg = EmailMessage(
        to=recipients,
        subject=subject,
        html=html,
        from_=from_ or settings.resend_from_email,
        reply_to=reply_to,
    )
    result = await tr.send(msg)
    return result.ok


def _lifecycle_base_html(campaign_title: str, old_stage: str, new_stage: str, notes: str | None, changed_by: str | None) -> str:
    notes_block = f"<p style='margin:12px 0 0;font-size:14px;color:#4a5644;'><strong>Nota:</strong> {notes}</p>" if notes else ""
    changed_by_block = f"<p style='margin:8px 0 0;font-size:13px;color:#7a8a72;'>Realizado por: {changed_by}</p>" if changed_by else ""
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;color:#7a8a72;letter-spacing:.04em;text-transform:uppercase;">Petición Cauce</p>
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#1a2516;line-height:1.2;">Cambio de etapa: {campaign_title}</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#4a5644;">
            La campaña avanzó de <strong>{old_stage}</strong> a <strong style="color:#3d6b35;">{new_stage}</strong>.
          </p>
          {notes_block}
          {changed_by_block}
        </td></tr>
      </table>
      {_PLATFORM_FOOTER_HTML}
    </td></tr>
  </table>
</body>
</html>"""


async def send_lifecycle_admin_notification(
    campaign_title: str,
    org_name: str,
    old_stage_index: int,
    new_stage_index: int,
    notes: str | None,
    changed_by_email: str | None,
) -> None:
    admin_emails = [e.strip() for e in settings.platform_admin_emails.split(",") if e.strip()]
    if not admin_emails:
        logger.info("[lifecycle] no platform_admin_emails configurados")
        return
    old_stage = _STAGE_NAMES[old_stage_index] if 0 <= old_stage_index <= 4 else str(old_stage_index)
    new_stage = _STAGE_NAMES[new_stage_index] if 0 <= new_stage_index <= 4 else str(new_stage_index)
    html = _lifecycle_base_html(campaign_title, old_stage, new_stage, notes, changed_by_email)
    subject = f"[Cauce Admin] {campaign_title} → {new_stage}"
    for email in admin_emails:
        await _send(email, subject, html)


async def send_lifecycle_org_notification(
    to_email: str,
    campaign_title: str,
    new_stage_index: int,
    notes: str | None,
) -> None:
    new_stage = _STAGE_NAMES[new_stage_index] if 0 <= new_stage_index <= 4 else str(new_stage_index)
    html = _lifecycle_base_html(campaign_title, "—", new_stage, notes, None)
    await _send(to_email, f"Actualización de campaña: {campaign_title}", html)


async def send_lifecycle_signer_notification(
    emails: list[str],
    campaign_title: str,
    current_stage_index: int,
    message: str,
) -> int:
    if not emails:
        return 0
    stage = _STAGE_NAMES[current_stage_index] if 0 <= current_stage_index <= 4 else str(current_stage_index)
    message_block = _render_message_html(message)
    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;color:#7a8a72;letter-spacing:.04em;text-transform:uppercase;">Petición Cauce</p>
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#1a2516;">{campaign_title}</h1>
          <p style="margin:0 0 8px;font-size:14px;color:#7a8a72;">Etapa actual: <strong>{stage}</strong></p>
          {message_block}
        </td></tr>
      </table>
      {_PLATFORM_FOOTER_HTML}
    </td></tr>
  </table>
</body>
</html>"""
    subject = f"Novedad de campaña: {campaign_title}"
    sent = 0
    for email in emails:
        if await _send(email, subject, html):
            sent += 1
    return sent


async def send_confirmation_email(
    to_email: str,
    token: str,
    campaign_title: str,
    signer_name: str = "",
    org_name: str = "",
    org_logo_url: str = "",
    visibility: str = "",
    privacy_url: str = "",
    org_contact_email: str = "",
) -> None:
    """`campaign_title` debe ser el título público (petition_title), no el interno."""
    confirm_url = f"{settings.api_public_url}{_CONFIRM_PATH}{token}"

    if not settings.resend_api_key:
        logger.info(
            "[dev] confirmation email | to=%s | url=%s",
            to_email,
            confirm_url,
        )
        return

    # La nota corresponde SOLO a la visibilidad elegida por el firmante
    # (la de secreta únicamente si así la eligió originalmente)
    vis_block = ""
    if visibility in _VISIBILITY_EXPLANATIONS:
        vis_block = f"<br><br>{_VISIBILITY_EXPLANATIONS[visibility]}"
        if org_contact_email:
            vis_block += (
                " Si más adelante deseas cambiar el tipo de visibilidad de tu firma "
                "(por ejemplo, pasarla a anónima), puedes solicitarlo escribiendo a "
                f"<a href=\"mailto:{org_contact_email}\" style='color:#3d6b35;font-weight:600;'>"
                f"{org_contact_email}</a>."
            )
    privacy_block = ""
    if privacy_url:
        privacy_block = (
            f"<br><br>Puedes leer el <a href=\"{privacy_url}\" "
            "style='color:#3d6b35;font-weight:600;'>aviso de privacidad</a> de la campaña."
        )

    html = _signer_action_html(
        heading="Confirma tu firma",
        body_html=(
            f"Gracias por apoyar <strong>{campaign_title}</strong>.<br>"
            "Haz clic en el botón para activar tu firma. El enlace es válido por 24 horas."
            f"{vis_block}{privacy_block}"
        ),
        cta_label="Confirmar mi firma →",
        cta_url=confirm_url,
        footer="Si no solicitaste esta acción, ignora este mensaje. Tu firma no quedará registrada.",
        signer_name=signer_name,
        org_name=org_name,
        org_logo_url=org_logo_url,
    )
    await _send(to_email, f"Confirma tu firma: {campaign_title}", html)


async def send_thanks_share_email(
    to_email: str,
    campaign_title: str,
    campaign_url: str,
    signer_name: str = "",
    org_name: str = "",
    org_logo_url: str = "",
    share_text: str = "",
    qr_code_data: str = "",
) -> None:
    """Segundo email tras confirmar la firma: agradecimiento + difusión (botones y QR)."""
    if not settings.resend_api_key:
        logger.info("[dev] thanks email | to=%s | campaign=%s", to_email, campaign_title)
        return

    first_name = signer_name.strip().split(" ")[0] if signer_name and signer_name.strip() else ""
    greeting = (
        f"<p style='margin:0 0 8px;font-size:16px;font-weight:700;color:#1a2516;'>"
        f"{first_name}, tu firma ya cuenta.</p>"
        if first_name
        else "<p style='margin:0 0 8px;font-size:16px;font-weight:700;color:#1a2516;'>Tu firma ya cuenta.</p>"
    )
    logo_block = (
        f"<img src=\"{org_logo_url}\" alt=\"{org_name or 'Organización'}\" width=\"48\" height=\"48\" "
        f"style=\"display:block;width:48px;height:48px;object-fit:contain;border-radius:10px;margin:0 0 12px;\">"
        if org_logo_url else ""
    )
    org_label = org_name or "Petición Cauce"

    clean_share = (share_text or "").replace("�", "").strip()
    share_msg = f"{clean_share}\n\n{campaign_url}" if clean_share else f"{campaign_title} — firma aquí: {campaign_url}"
    wa_url = f"https://wa.me/?text={quote(share_msg)}"
    fb_url = f"https://www.facebook.com/sharer/sharer.php?u={quote(campaign_url)}"
    x_url = f"https://twitter.com/intent/tweet?text={quote(share_msg)}"

    btn = "display:inline-block;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:100px;margin:0 6px 8px 0;"
    share_buttons = (
        f"<a href=\"{wa_url}\" style=\"{btn}background:#25D366;color:#fff;\">WhatsApp</a>"
        f"<a href=\"{fb_url}\" style=\"{btn}background:#1877F2;color:#fff;\">Facebook</a>"
        f"<a href=\"{x_url}\" style=\"{btn}background:#1a2516;color:#fff;\">X</a>"
    )

    # Nota: los data URIs no se muestran en todos los clientes de correo (Gmail
    # los bloquea); en esos casos el email degrada a los botones y el enlace.
    qr_block = (
        "<div style='margin:20px 0 4px;'>"
        f"<img src=\"{qr_code_data}\" alt=\"Código QR de la campaña\" width=\"140\" height=\"140\" "
        "style=\"display:block;width:140px;height:140px;\">"
        "<p style='margin:6px 0 0;font-size:12px;color:#9aaa92;'>Escanea o comparte este código QR.</p>"
        "</div>"
        if qr_code_data else ""
    )

    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          {logo_block}
          <p style="margin:0 0 4px;font-size:13px;color:#7a8a72;letter-spacing:.04em;text-transform:uppercase;">{org_label}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a2516;line-height:1.2;">¡Gracias por confirmar tu firma!</h1>
          {greeting}
          <p style="margin:0 0 20px;font-size:15px;color:#4a5644;line-height:1.6;">
            Tu apoyo a <strong>{campaign_title}</strong> quedó registrado.
            Ahora ayúdanos a que llegue más lejos: comparte la campaña con tu gente.
          </p>
          <div>{share_buttons}</div>
          {qr_block}
          <p style="margin:20px 0 0;font-size:13px;color:#7a8a72;line-height:1.5;">
            También puedes copiar y compartir el enlace directo:<br>
            <a href="{campaign_url}" style="color:#3d6b35;font-weight:600;word-break:break-all;">{campaign_url}</a>
          </p>
        </td></tr>
      </table>
      {_PLATFORM_FOOTER_HTML}
    </td></tr>
  </table>
</body>
</html>"""
    await _send(to_email, f"¡Gracias por tu firma! Ayuda a difundir: {campaign_title}", html)


async def send_visibility_change_email(
    to_email: str,
    token: str,
    campaign_title: str,
    new_visibility: str,
    signer_name: str = "",
    org_name: str = "",
    org_logo_url: str = "",
) -> None:
    """Notifica el cambio de visibilidad solicitado y pide confirmación (doble opt-in)."""
    confirm_url = f"{settings.api_public_url}/v1/public-campaign/confirm-visibility/{token}"
    labels = {"publica": "Pública", "anonima": "Anónima", "secreta": "Secreta"}
    label = labels.get(new_visibility, new_visibility)

    if not settings.resend_api_key:
        logger.info("[dev] visibility email | to=%s | url=%s | new=%s", to_email, confirm_url, new_visibility)
        return

    html = _signer_action_html(
        heading="Confirma el cambio de visibilidad de tu firma",
        body_html=(
            f"Registramos tu solicitud de cambiar la visibilidad de tu firma en "
            f"<strong>{campaign_title}</strong> a <strong>{label}</strong>.<br>"
            "Para aplicar el cambio, confírmalo con el botón. El enlace es válido por 24 horas."
        ),
        cta_label="Confirmar el cambio →",
        cta_url=confirm_url,
        footer="Si no solicitaste este cambio, ignora este mensaje y tu firma quedará como está.",
        signer_name=signer_name,
        org_name=org_name,
        org_logo_url=org_logo_url,
    )
    await _send(to_email, f"Confirma el cambio de visibilidad: {campaign_title}", html)


_ARCO_VERIFY_PATH = "/mis-datos/portal"

_ARCO_RIGHT_LABELS = {
    "supresion": "supresión de datos",
    "rectificacion": "rectificación de datos",
}


async def send_arco_verification_email(
    to_email: str,
    token: str,
    signer_name: str = "",
    campaign_count: int = 1,
) -> None:
    """Enlace de verificación de identidad para el portal de derechos ARCO (R1-R3, R1b).

    Platform-wide: no está atado a una campaña específica — el enlace abre
    una sesión de portal con todas las campañas encontradas. Válido 1h, un
    solo uso.
    """
    app_url = (settings.next_public_app_url or "http://localhost:3002").rstrip("/")
    verify_url = f"{app_url}{_ARCO_VERIFY_PATH}?token={token}"

    if not settings.resend_api_key:
        logger.info("[dev] arco verification email | to=%s | url=%s", to_email, verify_url)
        return

    campaign_phrase = (
        "una campaña de Cauce" if campaign_count <= 1 else f"{campaign_count} campañas de Cauce"
    )
    html = _signer_action_html(
        heading="Accede a tus datos",
        body_html=(
            f"Recibimos una solicitud para acceder a tus datos en {campaign_phrase}.<br>"
            "Haz clic en el botón para entrar al portal. El enlace es válido por 1 hora y de un solo uso."
        ),
        cta_label="Acceder a mis datos →",
        cta_url=verify_url,
        footer="Si no solicitaste esto, ignora este mensaje — nadie más puede acceder a tus datos sin este enlace.",
        signer_name=signer_name,
        org_name="Cauce",
        org_logo_url="",
    )
    await _send(to_email, "Accede a tus datos en Cauce", html)


async def send_arco_change_notification(
    to_email: str,
    action_label: str,
    campaign_title: str | None = None,
    signer_name: str = "",
) -> None:
    """R18: notifica al propio titular tras cualquier cambio hecho desde el portal ARCO
    (transparencia/seguridad — permite detectar uso no autorizado de la sesión)."""
    if not settings.resend_api_key:
        logger.info("[dev] arco change email | to=%s | action=%s | campaign=%s", to_email, action_label, campaign_title)
        return

    scope = f" en <strong>{campaign_title}</strong>" if campaign_title else " en tu cuenta de Cauce"
    html = _signer_action_html(
        heading="Actualizamos tus datos",
        body_html=(
            f"{action_label}{scope}.<br>"
            "Si no fuiste vos, escribinos de inmediato — alguien más pudo haber accedido a tu enlace."
        ),
        cta_label="Ir a mis datos →",
        cta_url=f"{(settings.next_public_app_url or 'http://localhost:3002').rstrip('/')}/mis-datos",
        footer="Este aviso se envía por cada cambio realizado desde el portal de derechos ARCO.",
        signer_name=signer_name,
        org_name="Cauce",
        org_logo_url="",
    )
    await _send(to_email, "Actualizamos tus datos en Cauce", html)


async def send_arco_org_notification(
    to_email: str,
    campaign_title: str,
    right_type: str,
    requested_at: str,
) -> None:
    """Notifica al Responsable el ejercicio de un derecho ARCO (R11). Fire-and-forget, sin PII del titular."""
    if not to_email:
        return
    label = _ARCO_RIGHT_LABELS.get(right_type, right_type)

    if not settings.resend_api_key:
        logger.info("[dev] arco org notification | to=%s | right=%s | campaign=%s", to_email, right_type, campaign_title)
        return

    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;color:#7a8a72;letter-spacing:.04em;text-transform:uppercase;">Petición Cauce</p>
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#1a2516;line-height:1.2;">Ejercicio de derecho ARCO: {campaign_title}</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#4a5644;">
            Un titular ejerció su derecho de <strong>{label}</strong> sobre sus datos en esta campaña.
          </p>
          <p style="margin:8px 0 0;font-size:13px;color:#7a8a72;">Fecha: {requested_at}</p>
        </td></tr>
      </table>
      {_PLATFORM_FOOTER_HTML}
    </td></tr>
  </table>
</body>
</html>"""
    await _send(to_email, f"[Cauce] Ejercicio de derecho ARCO — {campaign_title}", html)


async def send_arco_deletion_notification(
    to_email: str,
    campaign_title: str,
    signer_name: str = "",
    org_name: str = "",
    org_logo_url: str = "",
    org_contact_email: str = "",
) -> None:
    """Confirma al titular que sus datos fueron eliminados de inmediato (R7, supresión self-service)."""
    if not settings.resend_api_key:
        logger.info("[dev] arco deletion email | to=%s | campaign=%s", to_email, campaign_title)
        return

    contact_block = ""
    if org_contact_email:
        contact_block = (
            " Si tienes dudas, escríbenos a "
            f"<a href=\"mailto:{org_contact_email}\" style='color:#3d6b35;font-weight:600;'>"
            f"{org_contact_email}</a>."
        )

    first_name = signer_name.strip().split(" ")[0] if signer_name and signer_name.strip() else ""
    greeting = f"<p style='margin:0 0 8px;font-size:16px;font-weight:700;color:#1a2516;'>Hola {first_name},</p>" if first_name else ""
    logo_block = (
        f"<img src=\"{org_logo_url}\" alt=\"{org_name or 'Organización'}\" width=\"48\" height=\"48\" "
        f"style=\"display:block;width:48px;height:48px;object-fit:contain;border-radius:10px;margin:0 0 12px;\">"
        if org_logo_url else ""
    )
    org_label = org_name or "Petición Cauce"

    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          {logo_block}
          <p style="margin:0 0 4px;font-size:13px;color:#7a8a72;letter-spacing:.04em;text-transform:uppercase;">{org_label}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a2516;line-height:1.2;">Tus datos fueron eliminados</h1>
          {greeting}
          <p style="margin:0 0 20px;font-size:15px;color:#4a5644;line-height:1.6;">
            A tu solicitud, tus datos personales en <strong>{campaign_title}</strong> fueron eliminados definitivamente.
            Tu apoyo a la campaña seguirá contando de forma anónima.{contact_block}
          </p>
        </td></tr>
      </table>
      {_PLATFORM_FOOTER_HTML}
    </td></tr>
  </table>
</body>
</html>"""
    await _send(to_email, f"Tus datos fueron eliminados: {campaign_title}", html)


async def send_archive_notification(
    to_email: str,
    campaign_title: str,
    purge_date: str,
    signer_name: str = "",
    org_name: str = "",
    org_logo_url: str = "",
    org_contact_email: str = "",
) -> None:
    """Notifica la supresión solicitada por canal no digital (archivado admin, ventana 15 días — R3)."""
    if not settings.resend_api_key:
        logger.info("[dev] archive email | to=%s | purge_date=%s", to_email, purge_date)
        return

    contact_block = ""
    if org_contact_email:
        contact_block = (
            " Si deseas revertir esta acción antes de esa fecha, escríbenos a "
            f"<a href=\"mailto:{org_contact_email}\" style='color:#3d6b35;font-weight:600;'>"
            f"{org_contact_email}</a>."
        )

    first_name = signer_name.strip().split(" ")[0] if signer_name and signer_name.strip() else ""
    greeting = f"<p style='margin:0 0 8px;font-size:16px;font-weight:700;color:#1a2516;'>Hola {first_name},</p>" if first_name else ""
    logo_block = (
        f"<img src=\"{org_logo_url}\" alt=\"{org_name or 'Organización'}\" width=\"48\" height=\"48\" "
        f"style=\"display:block;width:48px;height:48px;object-fit:contain;border-radius:10px;margin:0 0 12px;\">"
        if org_logo_url else ""
    )
    org_label = org_name or "Petición Cauce"

    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          {logo_block}
          <p style="margin:0 0 4px;font-size:13px;color:#7a8a72;letter-spacing:.04em;text-transform:uppercase;">{org_label}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a2516;line-height:1.2;">Tus datos fueron archivados</h1>
          {greeting}
          <p style="margin:0 0 20px;font-size:15px;color:#4a5644;line-height:1.6;">
            A tu solicitud, tus datos personales en <strong>{campaign_title}</strong> quedaron archivados
            y serán eliminados definitivamente el <strong>{purge_date}</strong>.<br><br>
            Tu apoyo a la campaña seguirá contando de forma anónima.{contact_block}
          </p>
        </td></tr>
      </table>
      {_PLATFORM_FOOTER_HTML}
    </td></tr>
  </table>
</body>
</html>"""
    await _send(to_email, f"Tus datos fueron archivados: {campaign_title}", html)


async def send_name_completion_email(
    to_email: str,
    token: str,
    campaign_title: str,
    campaign_slug: str,
    org_name: str = "",
    org_logo_url: str = "",
    org_contact_email: str = "",
) -> None:
    """Remediación histórica: pide completar el nombre de una firma que quedó
    sin nombre o con nombre incompleto. Enlaza al popup público en la landing
    (?completar=<token>), no a una página nueva."""
    app_url = (settings.next_public_app_url or "http://localhost:3002").rstrip("/")
    complete_url = f"{app_url}/c/{campaign_slug}?completar={token}"

    if not settings.resend_api_key:
        logger.info("[dev] name completion email | to=%s | url=%s", to_email, complete_url)
        return

    contact_block = ""
    if org_contact_email:
        contact_block = (
            f"<br><br>Si tenés dudas sobre este pedido, escribinos a "
            f"<a href=\"mailto:{org_contact_email}\" style='color:#3d6b35;font-weight:600;'>"
            f"{org_contact_email}</a>."
        )

    html = _signer_action_html(
        heading="Ayúdanos a validar tu firma",
        body_html=(
            f"Estamos por entregar la campaña: <strong>{campaign_title}</strong> a la autoridad correspondiente. "
            "Para que tu firma llegue con todo su respaldo, necesitamos que completes tu nombre — "
            "quedó registrada sin él.<br><br>"
            "Tu nombre sigue sin mostrarse públicamente si así lo elegiste al firmar; esto solo "
            "corrige el dato interno."
            f"{contact_block}"
        ),
        cta_label="Completar y validar →",
        cta_url=complete_url,
        footer="Si no reconocés esta firma, ignora este mensaje.",
        org_name=org_name,
        org_logo_url=org_logo_url,
    )
    await _send(to_email, f"Completa tu firma: {campaign_title}", html)


async def send_export_absoluto_notification(
    org_contact_email: str | None,
    campaign_title: str,
    admin_email: str,
    row_count: int,
    secret_excluded_count: int,
    pending_included_count: int,
    created_at,
) -> None:
    """Notifica cada descarga absoluta de PII: al contacto de la org Responsable
    y a la plataforma. Control de transparencia/trazabilidad — no bloquea la
    descarga si falla el envío (ya se registró en pii_export_audit)."""
    fecha = created_at.strftime("%d/%m/%Y %H:%M UTC")
    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;color:#b45309;letter-spacing:.04em;text-transform:uppercase;">Descarga absoluta de datos</p>
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#1a2516;">{campaign_title}</h1>
          <p style="margin:0 0 8px;font-size:14px;color:#4a5644;line-height:1.6;">
            Se descargó el listado completo de firmantes (nombre, cédula y correo sin enmascarar)
            para preparar el documento de entrega oficial.
          </p>
          <table width="100%" style="margin:16px 0;font-size:13px;color:#4a5644;">
            <tr><td style="padding:2px 0;color:#7a8a72;">Realizada por</td><td style="padding:2px 0;text-align:right;">{admin_email}</td></tr>
            <tr><td style="padding:2px 0;color:#7a8a72;">Fecha</td><td style="padding:2px 0;text-align:right;">{fecha}</td></tr>
            <tr><td style="padding:2px 0;color:#7a8a72;">Filas incluidas</td><td style="padding:2px 0;text-align:right;">{row_count}</td></tr>
            <tr><td style="padding:2px 0;color:#7a8a72;">De esas, sin confirmar aún</td><td style="padding:2px 0;text-align:right;">{pending_included_count}</td></tr>
            <tr><td style="padding:2px 0;color:#7a8a72;">Secretas excluidas</td><td style="padding:2px 0;text-align:right;">{secret_excluded_count}</td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:#9aaa92;line-height:1.5;">
            Como Responsable del tratamiento, el resguardo y la retención de esta copia
            son de su responsabilidad conforme al contrato de encargo de tratamiento.
          </p>
        </td></tr>
      </table>
      {_PLATFORM_FOOTER_HTML}
    </td></tr>
  </table>
</body>
</html>"""
    subject = f"[Cauce] Descarga absoluta de firmantes — {campaign_title}"

    admin_emails = [e.strip() for e in settings.platform_admin_emails.split(",") if e.strip()]
    recipients = admin_emails + ([org_contact_email] if org_contact_email else [])
    if not recipients:
        logger.info("[export-absoluto] sin destinatarios configurados (platform_admin_emails/org.contact_email)")
        return
    await _send(recipients, subject, html)


async def send_confirmation_reminder_email(
    to_email: str,
    token: str,
    campaign_title: str,
    signer_name: str = "",
    org_name: str = "",
    org_logo_url: str = "",
    visibility: str = "",
    privacy_url: str = "",
    org_contact_email: str = "",
) -> None:
    """Variante de send_confirmation_email para 'Recordar a pendientes': aclara
    que la adhesión ya cuenta para la petición aunque no se haya confirmado,
    sin tocar el email original que se manda al momento de firmar."""
    confirm_url = f"{settings.api_public_url}{_CONFIRM_PATH}{token}"

    if not settings.resend_api_key:
        logger.info("[dev] reminder email | to=%s | url=%s", to_email, confirm_url)
        return

    vis_block = ""
    if visibility in _VISIBILITY_EXPLANATIONS:
        vis_block = f"<br><br>{_VISIBILITY_EXPLANATIONS[visibility]}"
        if org_contact_email:
            vis_block += (
                " Si más adelante deseas cambiar el tipo de visibilidad de tu firma "
                "(por ejemplo, pasarla a anónima), puedes solicitarlo escribiendo a "
                f"<a href=\"mailto:{org_contact_email}\" style='color:#3d6b35;font-weight:600;'>"
                f"{org_contact_email}</a>."
            )
    privacy_block = ""
    if privacy_url:
        privacy_block = (
            f"<br><br>Puedes leer el <a href=\"{privacy_url}\" "
            "style='color:#3d6b35;font-weight:600;'>aviso de privacidad</a> de la campaña."
        )

    html = _signer_action_html(
        heading="Tu adhesión ya cuenta — falta confirmar",
        body_html=(
            f"Tu adhesión a <strong>{campaign_title}</strong> ya se sumó a la petición, "
            "aunque todavía figura como pendiente de confirmar.<br><br>"
            "Confirmar activa el resto: que tu firma quede completa según la visibilidad "
            "que elegiste y, si corresponde, que tu nombre integre el documento de entrega."
            f"{vis_block}{privacy_block}"
        ),
        cta_label="Confirmar mi firma →",
        cta_url=confirm_url,
        footer="Si no reconocés esta adhesión, ignora este mensaje.",
        signer_name=signer_name,
        org_name=org_name,
        org_logo_url=org_logo_url,
    )
    await _send(to_email, f"Tu adhesión ya cuenta: {campaign_title}", html)


_MESES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _fmt_event_datetime(dt) -> str:
    aware = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    local = aware.astimezone(_TZ_EC)
    return f"{local.day} de {_MESES_ES[local.month - 1]} de {local.year} · {local.strftime('%H:%M')}"


def _render_message_html(text: str | None) -> str:
    """Convierte el texto plano del campo 'mensaje adicional' a HTML seguro:
    escapa el input antes de aplicar formato (nunca se inyecta HTML crudo del
    admin), soporta **negrita**, *cursiva*, saltos de línea simples (<br>) y
    párrafos (línea en blanco)."""
    if not text or not text.strip():
        return ""
    escaped = _html.escape(text.strip())
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"(?<!\*)\*([^*\n]+?)\*(?!\*)", r"<em>\1</em>", escaped)
    paragraphs = [p.replace("\n", "<br>") for p in escaped.split("\n\n") if p.strip()]
    inner = "".join(
        f"<p style='margin:0 0 10px;font-size:14px;color:#4a5644;line-height:1.6;'>{p}</p>"
        for p in paragraphs
    )
    return f"<div style='margin-top:20px;'>{inner}</div>"


def _ics_escape(text: str) -> str:
    return (text or "").replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")


def _calendar_links(*, title: str, event_datetime, location: str, details: str) -> dict:
    """Google Calendar y Outlook web usan deep links propios; Apple Calendar
    (y cualquier otro cliente ICS) usa el .ics servido por
    /v1/public-campaign/calendar.ics. Duración fija de 2h — no se captura
    hora de fin en el formulario."""
    start = event_datetime if event_datetime.tzinfo else event_datetime.replace(tzinfo=timezone.utc)
    start_utc = start.astimezone(timezone.utc)
    end_utc = start_utc + timedelta(hours=2)
    g_fmt = "%Y%m%dT%H%M%SZ"
    google = (
        "https://calendar.google.com/calendar/render?action=TEMPLATE"
        f"&text={quote(title)}&dates={start_utc.strftime(g_fmt)}/{end_utc.strftime(g_fmt)}"
        f"&details={quote(details)}&location={quote(location)}"
    )
    o_fmt = "%Y-%m-%dT%H:%M:%SZ"
    outlook = (
        "https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent"
        f"&subject={quote(title)}&startdt={quote(start_utc.strftime(o_fmt))}&enddt={quote(end_utc.strftime(o_fmt))}"
        f"&location={quote(location)}&body={quote(details)}"
    )
    ics_base = f"{settings.api_public_url}/v1/public-campaign/calendar.ics"
    ics = (
        f"{ics_base}?title={quote(title)}&start={quote(start_utc.strftime('%Y-%m-%dT%H:%M:%SZ'))}"
        f"&location={quote(location)}&details={quote(details)}"
    )
    return {"google": google, "outlook": outlook, "ics": ics}


def _social_href(key: str, value: str) -> str:
    """El campo 'email' de social_links es una dirección, no una URL —
    se arma el mailto: acá para que el admin solo tenga que cargar el correo."""
    value = value.strip()
    if key == "email":
        return value if value.startswith("mailto:") else f"mailto:{value}"
    # El resto son URLs. Los social_links se guardan sin normalizar
    # (SocialLinksUpdate acepta strings libres), así que si el admin cargó el
    # valor sin esquema (ej. "cauce.org"), el cliente de correo lo interpreta
    # como ruta relativa y el enlace queda roto. Fallback: anteponer https://
    # cuando falta un esquema explícito.
    if value.lower().startswith(("http://", "https://", "mailto:", "tel:")):
        return value
    return f"https://{value}"


# PNG estáticos (círculo de color + glifo horneado en el propio archivo),
# servidos desde el dominio de la web (apps/web/public/icons/social/) —
# reemplaza el SVG inline anterior. Ese SVG se eligió en su momento para
# evitar el bloqueo de Gmail a <img src="data:...">, pero Gmail tampoco
# renderiza <svg> inline (lo elimina del cuerpo del email): un <img> con
# URL pública normal evita ambos problemas. Mismos trazos que ya usaba el
# frontend (ShareSection.tsx, StepThanks.tsx).
_SOCIAL_ICONS = {
    "website": "Sitio web",
    "instagram": "Instagram",
    "facebook": "Facebook",
    "x": "X",
    "tiktok": "TikTok",
    "whatsapp": "WhatsApp",
    "newsletter": "Newsletter",
    "email": "Email",
}


def _powered_by_block(org_name: str) -> str:
    if not org_name:
        return ""
    return (
        "<p style='margin:16px 0 0;font-size:12px;color:#7a8a72;'>"
        f"Impulsado por: <strong style='color:#1a2516;'>{org_name}</strong></p>"
    )


def _social_icon_links(social_links: dict | None) -> str:
    social_links = social_links or {}
    icons_base = f"{settings.next_public_app_url.rstrip('/')}/icons/social"
    return "".join(
        f"<a href=\"{_social_href(key, social_links[key])}\" target=\"_blank\" rel=\"noopener\" "
        f"aria-label=\"{label}\" title=\"{label}\" "
        f"style=\"display:inline-block;margin:0 8px 8px 0;line-height:0;\">"
        f"<img src=\"{icons_base}/{key}.png\" width=\"36\" height=\"36\" alt=\"{label}\" "
        f"style=\"display:block;width:36px;height:36px;border-radius:50%;\"></a>"
        for key, label in _SOCIAL_ICONS.items()
        if social_links.get(key)
    )


def _build_delivery_event_invitation_html(
    *,
    campaign_title: str,
    event_title: str,
    event_subtitle: str | None = None,
    event_datetime,
    event_location: str,
    event_map_url: str | None = None,
    event_image_url: str | None = None,
    message: str | None = None,
    signer_name: str = "",
    social_links: dict | None = None,
    org_name: str = "",
    org_logo_url: str = "",
) -> str:
    """Construye el HTML de la invitación — usada tanto por el endpoint de
    vista previa como por el de envío real, para que sean idénticos.
    Se genera una vez por destinatario (personalizada con su nombre)."""
    logo_block = (
        f"<img src=\"{org_logo_url}\" alt=\"{org_name or 'Petición Cauce'}\" width=\"48\" height=\"48\" "
        "style=\"display:block;width:48px;height:48px;object-fit:contain;border-radius:10px;margin:0 0 12px;\">"
        if org_logo_url else ""
    )
    banner_block = (
        f"<img src=\"{event_image_url}\" alt=\"{campaign_title}\" width=\"416\" "
        "style=\"display:block;width:100%;max-width:416px;border-radius:14px;margin:0 0 20px;\">"
        if event_image_url else ""
    )
    map_button = (
        f"<a href=\"{event_map_url}\" target=\"_blank\" rel=\"noopener\" "
        "style=\"display:inline-block;color:#3d6b35;text-decoration:none;"
        "font-size:12px;font-weight:600;margin-top:6px;\">Ver ubicación →</a>"
        if event_map_url else ""
    )
    subtitle_block = (
        f"<p style='margin:0 0 12px;font-size:14px;font-weight:700;color:#1a2516;'>{event_subtitle}</p>"
        if event_subtitle else ""
    )
    message_block = _render_message_html(message)
    first_name = signer_name.strip().split(" ")[0] if signer_name and signer_name.strip() else ""
    greeting_body = (
        f"{first_name}, la campaña <strong>{campaign_title}</strong> te invita a participar "
        "del evento de entrega de la petición que apoyaste con tu firma."
        if first_name else
        f"La campaña <strong>{campaign_title}</strong> te invita a participar del evento de "
        "entrega de la petición que apoyaste con tu firma."
    )
    when = _fmt_event_datetime(event_datetime)

    cal = _calendar_links(
        title=event_title, event_datetime=event_datetime, location=event_location,
        details=message or campaign_title,
    )
    cal_link_style = (
        "color:#3d6b35;text-decoration:none;font-size:12px;font-weight:600;"
        "padding:6px 0;display:inline-block;"
    )
    calendar_block = (
        "<div style='margin-top:20px;padding-top:16px;border-top:1px solid rgba(22,38,31,0.12);'>"
        "<p style='margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.05em;"
        "text-transform:uppercase;color:#7a8a72;'>Agendar</p>"
        f"<a href=\"{cal['google']}\" target=\"_blank\" rel=\"noopener\" style=\"{cal_link_style}margin-right:16px;\">Google Calendar</a>"
        f"<a href=\"{cal['outlook']}\" target=\"_blank\" rel=\"noopener\" style=\"{cal_link_style}margin-right:16px;\">Outlook</a>"
        f"<a href=\"{cal['ics']}\" target=\"_blank\" rel=\"noopener\" style=\"{cal_link_style}\">Apple Calendar</a>"
        "</div>"
    )

    social_rows = _social_icon_links(social_links)
    social_block = (
        "<div style='margin-top:16px;'>"
        "<p style='margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.05em;"
        "text-transform:uppercase;color:#7a8a72;'>Seguí la causa</p>"
        f"<div>{social_rows}</div></div>"
        if social_rows else ""
    )

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          {banner_block}
          {logo_block}
          <p style="margin:0 0 4px;font-size:12px;color:#9aaa92;letter-spacing:.04em;text-transform:uppercase;font-family:'Work Sans',-apple-system,'Segoe UI',Roboto,sans-serif;">+CAUCES</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a2516;line-height:1.2;">{event_title}</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#4a5644;line-height:1.6;">{greeting_body}</p>
          <div style="background:#f4f5f0;border-radius:14px;padding:18px 20px;">
            {subtitle_block}
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#7a8a72;">Cuándo</p>
            <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1a2516;">{when}</p>
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#7a8a72;">Dónde</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#1a2516;">{event_location}</p>
            {map_button}
          </div>
          {message_block}
          {calendar_block}
          {_powered_by_block(org_name)}
          {social_block}
        </td></tr>
      </table>
      {_PLATFORM_FOOTER_HTML}
    </td></tr>
  </table>
</body>
</html>"""


async def send_delivery_event_invitation_email(
    recipients: list[tuple[str, str]],
    *,
    campaign_title: str,
    event_title: str | None = None,
    event_subtitle: str | None = None,
    event_datetime,
    event_location: str,
    event_map_url: str | None = None,
    event_image_url: str | None = None,
    message: str | None = None,
    subject_override: str | None = None,
    social_links: dict | None = None,
    org_name: str = "",
    org_logo_url: str = "",
) -> int:
    """`recipients` es (email, nombre) — el HTML se genera una vez por
    destinatario para personalizar el saludo con su nombre."""
    if not recipients:
        return 0
    subject = subject_override or f"Te invitamos: entrega de {campaign_title}"
    sent = 0
    for email, name in recipients:
        html = _build_delivery_event_invitation_html(
            campaign_title=campaign_title,
            event_title=event_title or "Entrega de la petición",
            event_subtitle=event_subtitle,
            event_datetime=event_datetime,
            event_location=event_location,
            event_map_url=event_map_url,
            event_image_url=event_image_url,
            message=message,
            signer_name=name,
            social_links=social_links,
            org_name=org_name,
            org_logo_url=org_logo_url,
        )
        if await _send(email, subject, html):
            sent += 1
    return sent


def _build_campaign_closing_html(
    *,
    campaign_title: str,
    final_count: int,
    social_links: dict,
    subtitle: str | None = None,
    image_url: str | None = None,
    message: str | None = None,
    signer_name: str = "",
    org_name: str = "",
    org_logo_url: str = "",
) -> str:
    """Construye el HTML del aviso de cierre — usada tanto por el endpoint de
    vista previa como por el de envío real, para que sean idénticos.
    Mismas funciones que la invitación al evento (personalización, subtítulo,
    imagen, mensaje, asunto editable) salvo fecha/hora/lugar — no aplica acá."""
    org_label = org_name or "Petición Cauce"
    logo_block = (
        f"<img src=\"{org_logo_url}\" alt=\"{org_label}\" width=\"48\" height=\"48\" "
        "style=\"display:block;width:48px;height:48px;object-fit:contain;border-radius:10px;margin:0 0 12px;\">"
        if org_logo_url else ""
    )
    banner_block = (
        f"<img src=\"{image_url}\" alt=\"{campaign_title}\" width=\"416\" "
        "style=\"display:block;width:100%;max-width:416px;border-radius:14px;margin:0 0 20px;\">"
        if image_url else ""
    )
    subtitle_block = (
        f"<p style='margin:0 0 12px;font-size:14px;font-weight:700;color:#1a2516;'>{subtitle}</p>"
        if subtitle else ""
    )
    message_block = _render_message_html(message)
    first_name = signer_name.strip().split(" ")[0] if signer_name and signer_name.strip() else ""
    greeting_body = (
        f"{first_name}, <strong>{campaign_title}</strong> dejó de recibir firmas. "
        "Gracias por tu adhesión — fue parte de esto:"
        if first_name else
        f"<strong>{campaign_title}</strong> dejó de recibir firmas. Gracias por tu adhesión — fue parte de esto:"
    )
    links_rows = _social_icon_links(social_links)
    links_block = (
        "<div style='margin-top:20px;'>"
        "<p style='margin:0 0 10px;font-size:13px;font-weight:700;color:#7a8a72;"
        "text-transform:uppercase;letter-spacing:.05em;'>Seguí la causa</p>"
        f"<div>{links_rows}</div></div>"
        if links_rows else ""
    )
    count_str = f"{final_count:,}".replace(",", ".")
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          {banner_block}
          {logo_block}
          <p style="margin:0 0 4px;font-size:13px;color:#7a8a72;letter-spacing:.04em;text-transform:uppercase;">{org_label}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a2516;line-height:1.2;">La campaña cerró</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#4a5644;line-height:1.6;">{greeting_body}</p>
          <div style="background:#f4f5f0;border-radius:14px;padding:20px;text-align:center;">
            {subtitle_block}
            <div style="font-size:34px;font-weight:800;color:#1a2516;">{count_str}</div>
            <div style="font-size:13px;color:#7a8a72;">firmas confirmadas</div>
          </div>
          {message_block}
          {_powered_by_block(org_name)}
          {links_block}
        </td></tr>
      </table>
      {_PLATFORM_FOOTER_HTML}
    </td></tr>
  </table>
</body>
</html>"""


async def send_campaign_closing_email(
    recipients: list[tuple[str, str]],
    *,
    campaign_title: str,
    final_count: int,
    social_links: dict,
    subtitle: str | None = None,
    image_url: str | None = None,
    message: str | None = None,
    subject_override: str | None = None,
    org_name: str = "",
    org_logo_url: str = "",
) -> int:
    """`recipients` es (email, nombre) — igual que la invitación al evento,
    el HTML se genera una vez por destinatario para personalizar el saludo."""
    if not recipients:
        return 0
    subject = subject_override or f"{campaign_title} — la campaña cerró"
    sent = 0
    for email, name in recipients:
        html = _build_campaign_closing_html(
            campaign_title=campaign_title,
            final_count=final_count,
            social_links=social_links or {},
            subtitle=subtitle,
            image_url=image_url,
            message=message,
            signer_name=name,
            org_name=org_name,
            org_logo_url=org_logo_url,
        )
        if await _send(email, subject, html):
            sent += 1
    return sent
