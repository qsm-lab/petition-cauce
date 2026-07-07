import logging
from typing import Sequence

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_CONFIRM_PATH = "/v1/public-campaign/confirm/"


def _confirmation_html(confirm_url: str, campaign_title: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f0;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,.06);">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;color:#7a8a72;letter-spacing:.04em;text-transform:uppercase;">Petición Cauce</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a2516;line-height:1.2;">Confirma tu firma</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#4a5644;line-height:1.6;">
            Gracias por apoyar <strong>{campaign_title}</strong>.<br>
            Haz clic en el botón para activar tu firma. El enlace es válido por 24 horas.
          </p>
          <a href="{confirm_url}"
             style="display:inline-block;background:#3d6b35;color:#fff;text-decoration:none;
                    font-size:15px;font-weight:700;padding:14px 32px;border-radius:100px;">
            Confirmar mi firma →
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#9aaa92;line-height:1.5;">
            Si no solicitaste esta acción, ignora este mensaje. Tu firma no quedará registrada.
          </p>
        </td></tr>
      </table>
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
) -> None:
    confirm_url = f"{settings.api_public_url}{_CONFIRM_PATH}{token}"

    if not settings.resend_api_key:
        logger.info(
            "[dev] confirmation email | to=%s | url=%s",
            to_email,
            confirm_url,
        )
        return

    html = _confirmation_html(confirm_url, campaign_title)

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
                    "to": [to_email],
                    "subject": f"Confirma tu firma: {campaign_title}",
                    "html": html,
                },
            )
            if resp.status_code not in (200, 201):
                logger.error("[resend] error %s: %s", resp.status_code, resp.text)
        except Exception as exc:
            logger.error("[resend] send failed: %s", exc)
