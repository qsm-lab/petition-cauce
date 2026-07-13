import logging
from typing import Sequence
from urllib.parse import quote

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_CONFIRM_PATH = "/v1/public-campaign/confirm/"

# Mismo texto del footer de la plataforma — transparencia en cada email (2.4)
_PLATFORM_FOOTER_HTML = (
    "<p style='margin:16px 0 0;font-size:11px;color:#9aaa92;text-align:center;line-height:1.5;'>"
    "Plataforma sin fines de lucro hecha en Ecuador · +Cauces.org · Todos los derechos reservados 2026"
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
          <p style="margin:0;font-size:15px;color:#4a5644;line-height:1.6;">{message}</p>
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
