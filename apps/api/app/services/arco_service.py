import csv
import io
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.crypto import PIIDecryptError, compute_hmac, decrypt_pii, encrypt_pii, verify_cedula
from app.models.arco_request import ArcoRequest
from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.organization import Organization
from app.models.signature import Signature
from app.schemas.arco import ArcoCampaignProfileRequest, ArcoOpposeRequest, ArcoPersonalDataRequest
from app.services.admin_signature_service import _mask_cedula, _mask_email, _mask_phone
from app.services.email_service import (
    send_arco_change_notification,
    send_arco_deletion_notification,
    send_arco_org_notification,
    send_arco_verification_email,
    send_confirmation_email,
)
from app.services.retention_service import anonymize_signature
from app.services.signature_service import build_privacy_url

logger = logging.getLogger(__name__)

_VERIFICATION_TTL_HOURS = 1
_PORTAL_SESSION_TTL_MINUTES = 30
_PORTAL_TOKEN_TYPE = "arco_portal"
_RECTIFIABLE_VISIBILITIES = {"publica", "anonima", "secreta"}
_SIGNABLE_STATUSES = {"draft", "active", "online"}
# Solo estos derechos notifican al Responsable al completarse (R11)
_ORG_NOTIFY_RIGHTS = {"supresion", "rectificacion"}


# ─── Helpers de contexto / auditoría ──────────────────────────────────────────

async def _platform_context(db: AsyncSession) -> None:
    """Habilita las políticas *_platform_admin (migración 016, FOR ALL) para el
    resto de la transacción. La identidad ya se probó a nivel de aplicación
    (doble factor + JWT de portal con signature_ids explícitos) — mismo patrón
    que ya usa retention_service.run_retention para operar sin conocer de
    antemano el org_id de cada fila (acá puede haber varias organizaciones
    distintas entre las campañas de un mismo titular)."""
    await db.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))


async def _resolve_campaign(db: AsyncSession, campaign_id: uuid.UUID) -> Campaign:
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if campaign is None:
        raise ValueError("no_encontrada")
    return campaign


async def _has_collision(
    db: AsyncSession, campaign_id: uuid.UUID, signer_type: str, field: str, new_hash: str, exclude_id: uuid.UUID,
) -> bool:
    """Replica los índices únicos parciales uq_sig_email_natural/org y uq_sig_cedula_natural
    (migración 006) — email/cédula son únicos por campaña, partidos por signer_type."""
    column = Signature.email_hash if field == "email" else Signature.cedula_hash
    result = await db.execute(
        select(Signature.id).where(
            Signature.campaign_id == campaign_id,
            Signature.signer_type == signer_type,
            column == new_hash,
            Signature.id != exclude_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def _latest_consent(db: AsyncSession, signature_id: uuid.UUID) -> Consent | None:
    result = await db.execute(
        select(Consent).where(Consent.signature_id == signature_id).order_by(Consent.created_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


def _record_audit(campaign_id: uuid.UUID, email_hash: str, right_type: str, result: str, detail: dict | None = None) -> ArcoRequest:
    now = datetime.now(timezone.utc)
    return ArcoRequest(
        campaign_id=campaign_id,
        right_type=right_type,
        email_hash=email_hash,
        completed_at=now if result == "completed" else None,
        result=result,
        detail=detail or {},
    )


async def _notify_org(db: AsyncSession, campaign_id: uuid.UUID, right_type: str, requested_at: datetime) -> None:
    if right_type not in _ORG_NOTIFY_RIGHTS:
        return
    try:
        campaign = await _resolve_campaign(db, campaign_id)
    except ValueError:
        return
    org_result = await db.execute(select(Organization).where(Organization.id == campaign.org_id))
    org = org_result.scalar_one_or_none()
    if org is None or not org.contact_email:
        return
    try:
        await send_arco_org_notification(
            to_email=org.contact_email,
            campaign_title=campaign.petition_title or campaign.title,
            right_type=right_type,
            requested_at=requested_at.isoformat(),
        )
    except Exception:
        logger.warning("[arco] failed to notify org for campaign %s", campaign_id)


async def _notify_titular(db: AsyncSession, sig: Signature, action_label: str, *, with_campaign: bool = True) -> None:
    """R18: cualquier cambio desde el portal se notifica al propio titular (transparencia/seguridad)."""
    if not sig.email_encrypted:
        return
    try:
        email = decrypt_pii(sig.email_encrypted, ref=str(sig.id))
        campaign_title = None
        if with_campaign:
            campaign = await _resolve_campaign(db, sig.campaign_id)
            campaign_title = campaign.petition_title or campaign.title
        await send_arco_change_notification(
            to_email=email,
            action_label=action_label,
            campaign_title=campaign_title,
            signer_name=sig.name or "",
        )
    except Exception:
        logger.warning("[arco] failed to send change notification for sig %s", sig.id)


# ─── Verificación de identidad (R1, R1b, R2-R4) ──────────────────────────────

async def request_access(db: AsyncSession, email: str, cedula: str, origin_campaign_id: str | None = None) -> None:
    """Siempre retorna None — la respuesta pública es genérica en todos los casos (R2).

    La búsqueda es platform-wide (R1b): no hay ninguna coincidencia observable
    desde afuera si no hay firmas, o si la única encontrada ya fue anonimizada
    (R12 — su email_hash/cedula_hash ya cambiaron, así que ni siquiera aparece
    en el WHERE).
    """
    await _platform_context(db)
    email_normalized = email.strip().lower()
    email_hash = compute_hmac(email_normalized)
    cedula_hash = compute_hmac(cedula.strip())

    result = await db.execute(
        select(Signature).where(
            Signature.email_hash == email_hash,
            Signature.cedula_hash == cedula_hash,
            Signature.anonymized_at.is_(None),
        )
    )
    matches = result.scalars().all()
    if not matches:
        # R10: sin coincidencia no hay campaign_id que auditar — no se registra nada
        return

    # El token se ancla a UNA sola fila (arco_verification_token es UNIQUE);
    # se prefiere la campaña de origen si está entre las coincidencias.
    anchor = matches[0]
    if origin_campaign_id:
        for sig in matches:
            if str(sig.campaign_id) == origin_campaign_id:
                anchor = sig
                break

    token = uuid.uuid4().hex
    now = datetime.now(timezone.utc)
    anchor.arco_verification_token = compute_hmac(token)
    anchor.arco_verification_expires_at = now + timedelta(hours=_VERIFICATION_TTL_HOURS)

    for sig in matches:
        db.add(_record_audit(sig.campaign_id, email_hash, "acceso", "completed", {"stage": "request_access"}))
    await db.commit()

    try:
        await send_arco_verification_email(
            to_email=email_normalized,
            token=token,
            signer_name=anchor.name or "",
            campaign_count=len(matches),
        )
    except Exception:
        logger.warning("[arco] failed to send verification email")


async def verify_token(
    db: AsyncSession, token: str, origin_campaign_id_hint: str | None = None,
) -> tuple[str, datetime] | None:
    """Verifica el token de un solo uso (R3). Retorna (portal_token, expires_at) o None si inválido/expirado."""
    await _platform_context(db)
    token_hash = compute_hmac(token)
    result = await db.execute(select(Signature).where(Signature.arco_verification_token == token_hash))
    anchor = result.scalar_one_or_none()
    if anchor is None:
        return None

    now = datetime.now(timezone.utc)
    exp = anchor.arco_verification_expires_at
    if exp is not None and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    expired = exp is None or now > exp

    # Un solo uso: el token se invalida se use o no dentro del plazo
    anchor.arco_verification_token = None
    anchor.arco_verification_expires_at = None

    if expired:
        await db.commit()
        return None

    # Re-consultar el conjunto vigente (R1b) — no la foto del momento del request_access
    result2 = await db.execute(
        select(Signature).where(
            Signature.email_hash == anchor.email_hash,
            Signature.cedula_hash == anchor.cedula_hash,
            Signature.anonymized_at.is_(None),
        )
    )
    matches = result2.scalars().all()
    if not matches:
        await db.commit()
        return None

    # Auto-confirmación de firmas pendientes en campañas aún firmables (R1c)
    auto_confirmed_ids: list[str] = []
    for sig in matches:
        if sig.status == "pending_confirmation":
            try:
                campaign = await _resolve_campaign(db, sig.campaign_id)
            except ValueError:
                continue
            if campaign.status in _SIGNABLE_STATUSES:
                sig.status = "confirmed"
                sig.confirmed_at = now
                auto_confirmed_ids.append(str(sig.id))

    signature_ids = [str(s.id) for s in matches]
    campaign_ids = {str(s.campaign_id) for s in matches}
    origin = origin_campaign_id_hint if origin_campaign_id_hint in campaign_ids else str(anchor.campaign_id)

    await db.commit()
    return _issue_portal_session(signature_ids, origin, auto_confirmed_ids)


def _issue_portal_session(
    signature_ids: list[str], origin_campaign_id: str, auto_confirmed_ids: list[str] | None = None,
) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=_PORTAL_SESSION_TTL_MINUTES)
    payload = {
        "typ": _PORTAL_TOKEN_TYPE,
        "signature_ids": signature_ids,
        "origin_campaign_id": origin_campaign_id,
        "auto_confirmed_ids": auto_confirmed_ids or [],
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_portal_session(token: str) -> dict:
    """Decodifica y valida el JWT de sesión de portal ARCO. Lanza ValueError si es inválido/expirado/de otro tipo."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise ValueError("sesion_invalida")
    if payload.get("typ") != _PORTAL_TOKEN_TYPE:
        raise ValueError("sesion_invalida")
    return payload


async def _get_session_signature(db: AsyncSession, session: dict, signature_id: uuid.UUID) -> Signature:
    if str(signature_id) not in session.get("signature_ids", []):
        raise ValueError("fuera_de_alcance")
    await _platform_context(db)
    result = await db.execute(select(Signature).where(Signature.id == signature_id))
    sig = result.scalar_one_or_none()
    if sig is None or sig.anonymized_at is not None:
        raise ValueError("no_encontrada")
    return sig


async def _get_session_signatures(db: AsyncSession, session: dict) -> list[Signature]:
    ids = session.get("signature_ids", [])
    if not ids:
        return []
    await _platform_context(db)
    result = await db.execute(
        select(Signature).where(
            Signature.id.in_([uuid.UUID(i) for i in ids]),
            Signature.anonymized_at.is_(None),
        )
    )
    return list(result.scalars().all())


# ─── Acceso (R5) ──────────────────────────────────────────────────────────────

async def get_subject_data(db: AsyncSession, session: dict) -> dict:
    sigs = await _get_session_signatures(db, session)
    if not sigs:
        raise ValueError("no_encontrada")

    # "Datos personales" son de la persona, no de una firma puntual — se toma
    # la fila más reciente como referencia de estado actual (R6a).
    ref = max(sigs, key=lambda s: s.created_at)
    email_masked = ""
    cedula_masked = None
    if ref.email_encrypted:
        try:
            email_masked = _mask_email(decrypt_pii(ref.email_encrypted, ref=str(ref.id)))
        except PIIDecryptError:
            pass
    if ref.cedula_encrypted:
        try:
            cedula_masked = _mask_cedula(decrypt_pii(ref.cedula_encrypted, ref=str(ref.id)))
        except PIIDecryptError:
            pass
    celular_masked = None
    if ref.celular_encrypted:
        try:
            celular_masked = _mask_phone(decrypt_pii(ref.celular_encrypted, ref=str(ref.id)))
        except PIIDecryptError:
            pass

    origin_campaign_id = session.get("origin_campaign_id")
    auto_confirmed_ids = set(session.get("auto_confirmed_ids", []))

    campaigns = []
    for sig in sigs:
        campaign = await _resolve_campaign(db, sig.campaign_id)
        consent = await _latest_consent(db, sig.id)
        signable = campaign.status in _SIGNABLE_STATUSES
        campaigns.append({
            "signature_id": sig.id,
            "campaign_id": sig.campaign_id,
            "campaign_title": campaign.petition_title or campaign.title,
            "visibility": sig.visibility,
            "status": sig.status,
            "signable": signable,
            "is_origin": str(sig.campaign_id) == origin_campaign_id,
            "confirmed_at": sig.confirmed_at.isoformat() if sig.confirmed_at else None,
            "created_at": sig.created_at.isoformat(),
            "just_auto_confirmed": str(sig.id) in auto_confirmed_ids,
            "consent": {
                "text_snapshot": consent.text_snapshot,
                "version": consent.version,
                "legal_basis": consent.legal_basis,
                "consented_at": consent.consented_at.isoformat() if consent.consented_at else None,
                "notify_updates": consent.notify_updates,
                "subscribe_newsletter": consent.subscribe_newsletter,
            } if consent else None,
            "signer_type": sig.signer_type,
            "org_name": sig.org_name,
            "location_mode": "internacional" if sig.country else "nacional",
            "provincia": sig.provincia,
            "country": sig.country,
            "profile_editable": sig.status == "pending_confirmation" and signable,
        })
        db.add(_record_audit(sig.campaign_id, sig.email_hash, "acceso", "completed", {"stage": "get_data"}))

    campaigns.sort(key=lambda c: not c["is_origin"])
    await db.commit()

    return {
        "name": ref.name,
        "email_masked": email_masked,
        "cedula_masked": cedula_masked,
        "celular_masked": celular_masked,
        "campaigns": campaigns,
    }


# ─── Rectificación — datos personales, compartidos (R6a) ────────────────────

async def _notify_titular_email(email: str, action_label: str, signer_name: str = "") -> None:
    try:
        await send_arco_change_notification(to_email=email, action_label=action_label, campaign_title=None, signer_name=signer_name)
    except Exception:
        logger.warning("[arco] failed to send change notification")


async def rectify_personal_data(db: AsyncSession, session: dict, data: ArcoPersonalDataRequest) -> dict:
    """Datos personales compartidos (R6a): nombre, email, cédula, celular — aplicados
    a TODAS las firmas no anonimizadas de la persona en una sola operación.

    - email/cédula son únicos por campaña (uq_sig_email_*/uq_sig_cedula_natural,
      migración 006) — si el valor nuevo ya está en uso en una campaña puntual,
      esa campaña queda sin cambios (reason="duplicado").
    - nombre/email/cédula ("datos esenciales para la firma") quedan atados de forma
      permanente a cualquier campaña que ya haya cerrado — pudieron usarse en la
      entrega formal (reason="campana_cerrada"). Provincia/país/tipo de firmante/
      ubicación NO viven acá — son por campaña (ver set_visibility/update_campaign_profile).
    - celular nunca formó parte de lo entregado — siempre editable.

    Retorna {"conflicts": [{"campaign_id", "campaign_title", "field", "reason"}]}.
    """
    sigs = await _get_session_signatures(db, session)
    if not sigs:
        raise ValueError("no_encontrada")

    new_email_normalized = data.email.strip().lower() if data.email else None
    new_email_hash = compute_hmac(new_email_normalized) if new_email_normalized else None
    new_cedula = data.cedula.strip() if data.cedula else None
    if new_cedula and len(new_cedula) == 10 and new_cedula.isdigit() and not verify_cedula(new_cedula):
        raise ValueError("cedula_invalida")
    new_cedula_hash = compute_hmac(new_cedula) if new_cedula else None

    requested_fields = []
    if data.name is not None:
        requested_fields.append("name")
    if new_email_hash is not None:
        requested_fields.append("email")
    if new_cedula_hash is not None:
        requested_fields.append("cedula")
    if data.celular is not None:
        requested_fields.append("celular")
    if not requested_fields:
        return {"conflicts": []}

    now = datetime.now(timezone.utc)
    conflicts: list[dict] = []
    to_resend_confirmation: list[Signature] = []

    # Todas las firmas de la sesión comparten el mismo email_hash/cedula_hash de
    # origen (verify_token las agrupó por esos hashes) — cualquiera sirve como
    # referencia del correo "viejo" para el aviso de seguridad.
    old_email = None
    if sigs[0].email_encrypted:
        try:
            old_email = decrypt_pii(sigs[0].email_encrypted, ref=str(sigs[0].id))
        except PIIDecryptError:
            pass

    for sig in sigs:
        campaign = await _resolve_campaign(db, sig.campaign_id)
        campaign_closed = campaign.status not in _SIGNABLE_STATUSES
        campaign_title = campaign.petition_title or campaign.title
        sig_fields: list[str] = []

        if new_email_hash is not None and new_email_hash != sig.email_hash:
            if campaign_closed:
                conflicts.append({"campaign_id": sig.campaign_id, "campaign_title": campaign_title, "field": "email", "reason": "campana_cerrada"})
            elif await _has_collision(db, sig.campaign_id, sig.signer_type, "email", new_email_hash, sig.id):
                conflicts.append({"campaign_id": sig.campaign_id, "campaign_title": campaign_title, "field": "email", "reason": "duplicado"})
            else:
                sig.email_encrypted = encrypt_pii(new_email_normalized)
                sig.email_hash = new_email_hash
                sig_fields.append("email")
                if sig.status == "pending_confirmation":
                    # R15/decisión de sesión 30: reenviar confirmación al correo nuevo
                    sig.confirmation_token = uuid.uuid4().hex
                    sig.confirmation_token_expires_at = now + timedelta(hours=24)
                    to_resend_confirmation.append(sig)

        if new_cedula_hash is not None and new_cedula_hash != sig.cedula_hash:
            if campaign_closed:
                conflicts.append({"campaign_id": sig.campaign_id, "campaign_title": campaign_title, "field": "cedula", "reason": "campana_cerrada"})
            elif await _has_collision(db, sig.campaign_id, sig.signer_type, "cedula", new_cedula_hash, sig.id):
                conflicts.append({"campaign_id": sig.campaign_id, "campaign_title": campaign_title, "field": "cedula", "reason": "duplicado"})
            else:
                sig.cedula_encrypted = encrypt_pii(new_cedula)
                sig.cedula_hash = new_cedula_hash
                sig_fields.append("cedula")

        if data.name is not None:
            if campaign_closed:
                # Datos esenciales de la firma (nombre/correo/cédula) quedan atados a la
                # campaña una vez que cerró — pudieron usarse en la entrega formal (R6a)
                conflicts.append({"campaign_id": sig.campaign_id, "campaign_title": campaign_title, "field": "name", "reason": "campana_cerrada"})
            else:
                # invariante heredada de formulario-firma: nombre solo se conserva en visibilidad pública
                sig.name = (data.name.strip() or None) if sig.visibility == "publica" else None
                sig_fields.append("name")

        if data.celular is not None:
            # Nunca formó parte de lo entregado — siempre editable, incluso con campaña cerrada
            celular = data.celular.strip()
            sig.celular_encrypted = encrypt_pii(celular) if celular else None
            sig_fields.append("celular")

        if sig_fields:
            # Trazabilidad sin PII: qué cambió, nunca el valor (R6a)
            db.add(_record_audit(sig.campaign_id, sig.email_hash, "rectificacion", "completed", {"stage": "personal_data", "fields_changed": sig_fields}))

    await db.commit()

    for sig in sigs:
        await _notify_org(db, sig.campaign_id, "rectificacion", now)

    for sig in to_resend_confirmation:
        try:
            campaign = await _resolve_campaign(db, sig.campaign_id)
            org_result = await db.execute(select(Organization).where(Organization.id == campaign.org_id))
            org = org_result.scalar_one_or_none()
            await send_confirmation_email(
                to_email=new_email_normalized,
                token=sig.confirmation_token,
                campaign_title=campaign.petition_title or campaign.title,
                signer_name=sig.name or "",
                org_name=org.name if org else "",
                org_logo_url=(org.logo_url or "") if org else "",
                visibility=sig.visibility,
                privacy_url=build_privacy_url(campaign.slug),
                org_contact_email=(org.contact_email or "") if org else "",
            )
        except Exception:
            logger.warning("[arco] failed to resend confirmation for sig %s", sig.id)

    if old_email:
        label = "Actualizaste tus datos personales" + (" (incluye un cambio de correo)" if new_email_hash else "")
        await _notify_titular_email(old_email, label, sigs[0].name or "")

    return {"conflicts": conflicts}


# ─── Rectificación — visibilidad, por campaña (R6b) ──────────────────────────

async def set_visibility(db: AsyncSession, session: dict, signature_id: uuid.UUID, visibility: str) -> None:
    if visibility not in _RECTIFIABLE_VISIBILITIES:
        raise ValueError("visibilidad_invalida")
    sig = await _get_session_signature(db, session, signature_id)

    sig.visibility = visibility
    if visibility != "publica":
        sig.name = None

    now = datetime.now(timezone.utc)
    db.add(_record_audit(sig.campaign_id, sig.email_hash, "rectificacion", "completed", {"stage": "visibility"}))
    await db.commit()

    await _notify_org(db, sig.campaign_id, "rectificacion", now)
    await _notify_titular(db, sig, "Cambiaste la visibilidad de tu firma")


# ─── Perfil por campaña: tipo de firmante, ubicación, provincia/país ─────────

async def update_campaign_profile(db: AsyncSession, session: dict, signature_id: uuid.UUID, data: ArcoCampaignProfileRequest) -> None:
    """Campos por campaña (R6b), separados de los datos personales compartidos:

    - `signer_type`/`location_mode` son estructurales (cambian qué otros campos
      aplican) — solo editables mientras la firma sigue `pending_confirmation`
      Y la campaña acepta firmas. Una vez confirmada o cerrada la campaña, quedan
      fijos (igual criterio que en el alta original: se eligen una vez).
    - `provincia`/`country` NO son "esenciales para la firma" — editables siempre,
      independiente del estado de la campaña o de confirmación.
    """
    sig = await _get_session_signature(db, session, signature_id)
    campaign = await _resolve_campaign(db, sig.campaign_id)

    structural_change = data.signer_type is not None or data.location_mode is not None
    if structural_change:
        if sig.status != "pending_confirmation" or campaign.status not in _SIGNABLE_STATUSES:
            raise ValueError("perfil_no_editable")

    fields_changed: list[str] = []

    if data.signer_type is not None:
        if data.signer_type not in ("natural", "org"):
            raise ValueError("tipo_firmante_invalido")
        sig.signer_type = data.signer_type
        if data.signer_type == "org":
            org_name = (data.org_name or "").strip() or None
            sig.org_name = org_name
            sig.org_name_hash = compute_hmac(org_name) if org_name else None
        else:
            sig.org_name = None
            sig.org_name_hash = None
        fields_changed.append("signer_type")

    if data.location_mode is not None:
        if data.location_mode not in ("nacional", "internacional"):
            raise ValueError("ubicacion_invalida")
        # Al cambiar de modo se limpia el campo del modo anterior (mismo criterio que el alta)
        if data.location_mode == "nacional":
            sig.country = None
        else:
            sig.provincia = None
        fields_changed.append("location_mode")

    if data.provincia is not None:
        sig.provincia = data.provincia.strip() or None
        fields_changed.append("provincia")
    if data.country is not None:
        sig.country = data.country.strip() or None
        fields_changed.append("country")

    if not fields_changed:
        return

    now = datetime.now(timezone.utc)
    db.add(_record_audit(sig.campaign_id, sig.email_hash, "rectificacion", "completed", {"stage": "campaign_profile", "fields_changed": fields_changed}))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ValueError("ya_firmaste")

    await _notify_org(db, sig.campaign_id, "rectificacion", now)
    await _notify_titular(db, sig, "Actualizaste el detalle de tu firma")


# ─── Confirmación manual de firma pendiente (R14) ────────────────────────────

async def confirm_pending(db: AsyncSession, session: dict, signature_id: uuid.UUID) -> None:
    sig = await _get_session_signature(db, session, signature_id)
    if sig.status != "pending_confirmation":
        raise ValueError("ya_confirmada")
    campaign = await _resolve_campaign(db, sig.campaign_id)
    if campaign.status not in _SIGNABLE_STATUSES:
        raise ValueError("campana_cerrada")

    sig.status = "confirmed"
    sig.confirmed_at = datetime.now(timezone.utc)
    await db.commit()

    await _notify_titular(db, sig, "Confirmaste tu firma")


# ─── Oposición, por campaña (R8) ─────────────────────────────────────────────

async def oppose(db: AsyncSession, session: dict, signature_id: uuid.UUID, data: ArcoOpposeRequest) -> None:
    sig = await _get_session_signature(db, session, signature_id)
    consent = await _latest_consent(db, sig.id)
    if consent is None:
        raise ValueError("no_encontrada")

    if data.notify_updates is not None:
        consent.notify_updates = data.notify_updates
    if data.subscribe_newsletter is not None:
        consent.subscribe_newsletter = data.subscribe_newsletter

    db.add(_record_audit(sig.campaign_id, sig.email_hash, "oposicion", "completed"))
    await db.commit()

    await _notify_titular(db, sig, "Actualizaste tus preferencias de contacto")


# ─── Portabilidad, unificada (R9) ────────────────────────────────────────────

async def export_data(db: AsyncSession, session: dict, fmt: str) -> tuple[str, str, str]:
    """Genera el export on-demand (JSON o CSV) de TODAS las campañas de la sesión, sin persistir archivo."""
    sigs = await _get_session_signatures(db, session)
    if not sigs:
        raise ValueError("no_encontrada")

    rows = []
    for sig in sigs:
        campaign = await _resolve_campaign(db, sig.campaign_id)
        consent = await _latest_consent(db, sig.id)
        email = decrypt_pii(sig.email_encrypted, ref=str(sig.id)) if sig.email_encrypted else ""
        cedula = decrypt_pii(sig.cedula_encrypted, ref=str(sig.id)) if sig.cedula_encrypted else ""
        rows.append({
            "campaign": campaign.petition_title or campaign.title,
            "name": sig.name,
            "email": email,
            "cedula": cedula,
            "provincia": sig.provincia,
            "country": sig.country,
            "visibility": sig.visibility,
            "status": sig.status,
            "confirmed_at": sig.confirmed_at.isoformat() if sig.confirmed_at else None,
            "created_at": sig.created_at.isoformat(),
            "consent_text": consent.text_snapshot if consent else None,
            "consent_version": consent.version if consent else None,
            "consent_legal_basis": consent.legal_basis if consent else None,
        })
        db.add(_record_audit(sig.campaign_id, sig.email_hash, "portabilidad", "completed"))
    await db.commit()

    if fmt == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        return output.getvalue(), "text/csv; charset=utf-8", "mis-datos-cauce.csv"

    return json.dumps(rows, ensure_ascii=False, indent=2), "application/json", "mis-datos-cauce.json"


# ─── Supresión, por campaña (R7) ─────────────────────────────────────────────

async def delete_subject(db: AsyncSession, session: dict, signature_id: uuid.UUID) -> None:
    sig = await _get_session_signature(db, session, signature_id)
    campaign = await _resolve_campaign(db, sig.campaign_id)

    original_email_hash = sig.email_hash
    signer_name = sig.name or ""
    email: str | None = None
    if sig.email_encrypted:
        try:
            email = decrypt_pii(sig.email_encrypted, ref=str(sig.id))
        except PIIDecryptError:
            email = None

    now = datetime.now(timezone.utc)
    anonymize_signature(sig, now)

    db.add(ArcoRequest(
        campaign_id=sig.campaign_id,
        right_type="supresion",
        email_hash=original_email_hash,
        completed_at=now,
        result="completed",
        detail={"trigger": "arco_self_service"},
    ))
    await db.commit()

    if email:
        try:
            org_result = await db.execute(select(Organization).where(Organization.id == campaign.org_id))
            org = org_result.scalar_one_or_none()
            await send_arco_deletion_notification(
                to_email=email,
                campaign_title=campaign.petition_title or campaign.title,
                signer_name=signer_name,
                org_name=org.name if org else "",
                org_logo_url=(org.logo_url or "") if org else "",
                org_contact_email=(org.contact_email or "") if org else "",
            )
        except Exception:
            logger.warning("[arco] failed to send deletion confirmation for sig %s", sig.id)

    await _notify_org(db, sig.campaign_id, "supresion", now)
