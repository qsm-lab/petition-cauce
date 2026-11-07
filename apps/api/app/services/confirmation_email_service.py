"""Envío del correo de confirmación fuera de la petición de alta, con reintentos
(correo-recuperacion, hardening-campana T1.5).

`create_signature` solo guarda la firma con `confirmation_email_status='pending'`. Dos caminos envían:
un intento inmediato en segundo plano (`attempt_send` desde el router) y un loop periódico que recupera lo
pendiente, lo fallido y lo que quedó `sending` por una caída (`process_due`).

Ambos pasan por el mismo reclamo atómico (`UPDATE ... WHERE status IN ('pending','failed') ... rowcount`):
por firma solo un proceso envía por intento, aunque coincidan varios workers. Las transiciones de estado son
UPDATE estilo Core condicionados al estado esperado, no asignación ORM (lección del incidente de la cola, sesión 42).
Garantía: al menos un envío. Si el proceso cae entre el acuse del proveedor y el UPDATE a `sent`, la firma
vuelve a `failed` a los 5 minutos y se reenvía (duplicado raro, aceptado).
"""
import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, or_, select, update

from app.config import settings
from app.crypto import compute_hmac, decrypt_pii
from app.database import AsyncSessionLocal, set_rls_context
from app.models.campaign import Campaign
from app.models.organization import Organization
from app.models.signature import Signature
from app.services.admin_signature_service import _mask_cedula, _mask_phone
from app.services.email_service import send_confirmation_email
from app.services.signature_service import _ARCO_REVIEW_TTL_HOURS, _TOKEN_TTL_HOURS, build_privacy_url

logger = logging.getLogger(__name__)

# Retardo tras el intento n (1-based); pasado el último se repite.
BACKOFF_SECONDS = (60, 300, 900, 3600, 10800)
STALE_SENDING_SECONDS = 300
TOKEN_RENEW_MARGIN = timedelta(hours=1)

_PENDING = ("pending", "failed")


class _Limits:
    """Velocidad y concurrencia por proceso. Se recrea si cambia el event loop (tests)."""

    def __init__(self) -> None:
        self.loop = asyncio.get_running_loop()
        self.lock = asyncio.Lock()
        self.semaphore = asyncio.Semaphore(max(1, settings.confirm_email_max_concurrent))
        self.next_slot = 0.0

    async def reserve(self, max_wait: float | None) -> bool:
        """Reserva un turno de envío. Con `max_wait`, devuelve False si el turno queda más lejos que eso."""
        rate = settings.confirm_email_max_per_second
        interval = 1.0 / rate if rate > 0 else 0.0
        async with self.lock:
            now = time.monotonic()
            slot = max(now, self.next_slot)
            wait = slot - now
            if max_wait is not None and wait > max_wait:
                return False
            self.next_slot = slot + interval
        if wait > 0:
            await asyncio.sleep(wait)
        return True


_limits: _Limits | None = None


def _get_limits() -> _Limits:
    global _limits
    if _limits is None or _limits.loop is not asyncio.get_running_loop():
        _limits = _Limits()
    return _limits


async def _claim(db, sig_id: uuid.UUID) -> bool:
    result = await db.execute(
        update(Signature)
        .where(
            Signature.id == sig_id,
            Signature.confirmation_email_status.in_(_PENDING),
            or_(Signature.confirmation_email_next_at.is_(None), Signature.confirmation_email_next_at <= func.now()),
        )
        .values(
            confirmation_email_status="sending",
            confirmation_email_claimed_at=func.now(),
            confirmation_email_attempts=Signature.confirmation_email_attempts + 1,
        )
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    return result.rowcount == 1


async def _close(db, sig_id: uuid.UUID, **values) -> None:
    """Cierra un intento. Condicionado a `sending`: no pisa a una recuperación que ya lo reabrió."""
    await db.execute(
        update(Signature)
        .where(Signature.id == sig_id, Signature.confirmation_email_status == "sending")
        .values(**values)
        .execution_options(synchronize_session=False)
    )
    await db.commit()


def _aware(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def _deliver(db, sig: Signature) -> bool | None:
    """True/False según el proveedor; None si el correo ya no corresponde (firma confirmada o anulada)."""
    if sig.status != "pending_confirmation" or sig.anulada_at is not None:
        return None

    now = datetime.now(timezone.utc)
    expires = _aware(sig.confirmation_token_expires_at)
    # R6: el enlace debe estar vigente cuando llega. Se persiste ANTES de enviar.
    if not sig.confirmation_token or expires is None or expires - now < TOKEN_RENEW_MARGIN:
        sig.confirmation_token = uuid.uuid4().hex
        sig.confirmation_token_expires_at = now + timedelta(hours=_TOKEN_TTL_HOURS)
    # La BD guarda solo el HMAC del token del portal ARCO: no se puede reconstruir, se emite uno nuevo.
    arco_review_token = uuid.uuid4().hex
    sig.arco_verification_token = compute_hmac(arco_review_token)
    sig.arco_verification_expires_at = now + timedelta(hours=_ARCO_REVIEW_TTL_HOURS)
    await db.commit()

    campaign = (await db.execute(select(Campaign).where(Campaign.id == sig.campaign_id))).scalar_one()
    org = (await db.execute(select(Organization).where(Organization.id == campaign.org_id))).scalar_one_or_none()

    ref = str(sig.id)
    to_email = decrypt_pii(sig.email_encrypted, ref=ref)
    cedula = decrypt_pii(sig.cedula_encrypted, ref=ref) if sig.cedula_encrypted else ""
    celular = decrypt_pii(sig.celular_encrypted, ref=ref) if sig.celular_encrypted else ""

    app_url = (settings.next_public_app_url or "http://localhost:3002").rstrip("/")
    return await send_confirmation_email(
        to_email=to_email,
        token=sig.confirmation_token,
        campaign_title=campaign.petition_title or campaign.title,
        signer_name=sig.name or "",
        org_name=org.name if org else "",
        org_logo_url=(org.logo_url or "") if org else "",
        visibility=sig.visibility,
        privacy_url=build_privacy_url(campaign.slug),
        org_contact_email=(org.contact_email or "") if org else "",
        entered_name=sig.name or "",
        entered_cedula_masked=_mask_cedula(cedula) if cedula else "",
        entered_org_name=(sig.org_name or "") if sig.signer_type == "org" else "",
        entered_location=sig.provincia or sig.country or "",
        entered_celular_masked=_mask_phone(celular) if celular else "",
        arco_review_url=f"{app_url}/mis-datos/portal?token={arco_review_token}&campaign={campaign.id}",
    )


async def attempt_send(sig_id: uuid.UUID, *, max_wait: float | None = None) -> str:
    """Un intento de envío para una firma. Devuelve sent|failed|gave_up|not_required|skipped.

    `max_wait` acota la espera del turno de velocidad: el intento inmediato pasa un valor pequeño y, si no
    hay turno, deja la firma `pending` para el loop. El loop espera sin límite.
    """
    limits = _get_limits()
    if not await limits.reserve(max_wait):
        return "skipped"
    async with limits.semaphore:
        async with AsyncSessionLocal() as db:
            await set_rls_context(db, platform_admin=True)
            if not await _claim(db, sig_id):
                return "skipped"
            sig = (await db.execute(select(Signature).where(Signature.id == sig_id))).scalar_one()
            attempts = sig.confirmation_email_attempts
            try:
                outcome = await _deliver(db, sig)
            except Exception as exc:  # noqa: BLE001 — cualquier fallo es reintentable; sin PII en el log
                logger.warning("confirm_email_error sig=%s attempt=%s error=%s", sig_id, attempts, type(exc).__name__)
                outcome = False

            if outcome is None:
                await _close(db, sig_id, confirmation_email_status="not_required", confirmation_email_next_at=None)
                return "not_required"
            if outcome:
                await _close(
                    db, sig_id,
                    confirmation_email_status="sent",
                    confirmation_email_sent_at=func.now(),
                    confirmation_email_next_at=None,
                )
                logger.info("confirm_email_sent sig=%s attempt=%s", sig_id, attempts)
                return "sent"
            if attempts >= settings.confirm_email_max_attempts:
                await _close(db, sig_id, confirmation_email_status="gave_up", confirmation_email_next_at=None)
                logger.error("confirm_email_gave_up sig=%s attempts=%s", sig_id, attempts)
                return "gave_up"
            delay = BACKOFF_SECONDS[min(attempts, len(BACKOFF_SECONDS)) - 1]
            await _close(
                db, sig_id,
                confirmation_email_status="failed",
                confirmation_email_next_at=datetime.now(timezone.utc) + timedelta(seconds=delay),
            )
            logger.warning("confirm_email_failed sig=%s attempt=%s retry_in=%ss", sig_id, attempts, delay)
            return "failed"


async def recover_stale(db) -> int:
    """R5: un `sending` que nadie cerró (caída del proceso) vuelve a `failed` (o `gave_up` si agotó intentos)."""
    result = await db.execute(
        update(Signature)
        .where(
            Signature.confirmation_email_status == "sending",
            Signature.confirmation_email_claimed_at < func.now() - timedelta(seconds=STALE_SENDING_SECONDS),
        )
        .values(
            confirmation_email_status=case(
                (Signature.confirmation_email_attempts >= settings.confirm_email_max_attempts, "gave_up"),
                else_="failed",
            ),
            confirmation_email_next_at=func.now(),
        )
        .execution_options(synchronize_session=False)
    )
    await db.commit()
    return result.rowcount


async def process_due() -> dict:
    """Un tick del loop: recupera `sending` caducados y reintenta lo vencido, en un lote acotado."""
    async with AsyncSessionLocal() as db:
        await set_rls_context(db, platform_admin=True)
        recovered = await recover_stale(db)
        ids = (
            await db.execute(
                select(Signature.id)
                .where(
                    Signature.confirmation_email_status.in_(_PENDING),
                    or_(Signature.confirmation_email_next_at.is_(None), Signature.confirmation_email_next_at <= func.now()),
                )
                .order_by(Signature.confirmation_email_next_at.asc().nulls_first())
                .limit(settings.confirm_email_batch_size)
            )
        ).scalars().all()
    results = await asyncio.gather(*(attempt_send(i) for i in ids)) if ids else []
    counts: dict = {"recovered": recovered, "due": len(ids)}
    for r in results:
        counts[r] = counts.get(r, 0) + 1
    return counts
