import html as _html
import logging
import re
from datetime import timedelta, timezone
from typing import Sequence
from urllib.parse import quote
from zoneinfo import ZoneInfo

import httpx

from app.config import settings

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


async def _send(to: str | Sequence[str], subject: str, html: str) -> bool:
    recipients = [to] if isinstance(to, str) else list(to)
    if not recipients:
        return False
    if not settings.resend_api_key:
        logger.info("[dev] email | to=%s | subject=%s", recipients, subject)
        return True
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.resend_from_email,
                    "to": recipients,
                    "subject": subject,
                    "html": html,
                },
            )
            if resp.status_code not in (200, 201):
                logger.error("[resend] error %s: %s", resp.status_code, resp.text)
                return False
            return True
        except Exception as exc:
            logger.error("[resend] send failed: %s", exc)
            return False


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
    if key == "email":
        return value if value.startswith("mailto:") else f"mailto:{value}"
    return value


# Íconos en SVG inline (no <img src="data:...">, que Gmail bloquea — ver
# hallazgo del QR del email de agradecimiento, sesión 27). El SVG embebido
# como markup no es una carga de imagen, así que no le aplica ese bloqueo.
# Mismos trazos que ya usa el frontend (ShareSection.tsx, StepThanks.tsx)
# para consistencia visual; TikTok/sitio web/newsletter son íconos genéricos
# ya que no había uno existente en el código para reutilizar.
_SOCIAL_ICONS = {
    "website": (
        "#3d6b35",
        "Sitio web",
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" '
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>'
        '<path d="M12 2a15 15 0 010 20 15 15 0 010-20"/></svg>'
    ),
    "instagram": (
        "#C13584",
        "Instagram",
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" '
        'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
        '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/>'
        '<circle cx="17.5" cy="6.5" r="0.5" fill="#fff" stroke="none"/></svg>'
    ),
    "facebook": (
        "#1877F2",
        "Facebook",
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">'
        '<path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.971h-1.514c-1.491 0-1.955.931-1.955 1.887v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>'
    ),
    "x": (
        "#000000",
        "X",
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="#fff">'
        '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>'
    ),
    "tiktok": (
        "#000000",
        "TikTok",
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" '
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
    ),
    "whatsapp": (
        "#25D366",
        "WhatsApp",
        '<svg width="16" height="16" viewBox="0 0 32 32" fill="#fff">'
        '<path d="M16 3C8.82 3 3 8.82 3 16c0 2.3.62 4.47 1.7 6.34L3 29l6.85-1.65A13 13 0 0016 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 2c6.07 0 11 4.93 11 11s-4.93 11-11 11c-2.02 0-3.9-.55-5.52-1.5l-.39-.23-4.06.98.99-3.96-.26-.42A10.96 10.96 0 015 16C5 9.93 9.93 5 16 5zm-3.4 5.5c-.2 0-.52.08-.8.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.14.2 2.07 3.24 5.08 4.42.71.31 1.26.49 1.69.62.71.22 1.36.19 1.87.12.57-.08 1.75-.72 2-1.41.25-.7.25-1.3.18-1.42-.08-.12-.27-.2-.57-.34-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.34.22-.64.08-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.78-1.68-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.34.44-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.14-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01z"/></svg>'
    ),
    "newsletter": (
        "#3d6b35",
        "Newsletter",
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" '
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
    ),
    "email": (
        "#7a8a72",
        "Email",
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" '
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>'
    ),
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
    return "".join(
        f"<a href=\"{_social_href(key, social_links[key])}\" target=\"_blank\" rel=\"noopener\" "
        f"aria-label=\"{label}\" title=\"{label}\" "
        f"style=\"display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;"
        f"border-radius:50%;background:{color};margin:0 8px 8px 0;text-decoration:none;\">{svg}</a>"
        for key, (color, label, svg) in _SOCIAL_ICONS.items()
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
