import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.lifecycle_event import LifecycleEvent
from app.models.privacy_config import PrivacyConfig
from app.models.retention_run import RetentionRun
from app.models.signature import Signature

logger = logging.getLogger(__name__)

_DEFAULT_RETENTION_DAYS = 365
_BATCH_SIZE = 500


async def get_campaign_anchor(db: AsyncSession, campaign_id: uuid.UUID) -> datetime | None:
    """Fecha del primer evento de ciclo de vida 'entrega' de la campaña, o None si aún no llegó a esa etapa (R2)."""
    result = await db.execute(
        select(func.min(LifecycleEvent.registered_at)).where(
            LifecycleEvent.campaign_id == campaign_id,
            LifecycleEvent.stage == "entrega",
        )
    )
    return result.scalar_one_or_none()


def compute_expiry(anchor: datetime, retention_days: int) -> datetime:
    return anchor + timedelta(days=retention_days)


def anonymize_signature(sig: Signature, now: datetime) -> None:
    """Anonimiza los campos identificantes de una firma, preservando los agregables (R3, R4)."""
    sig.name = None
    sig.org_name = None
    sig.org_name_hash = None
    sig.cedula_encrypted = None
    sig.cedula_hash = None
    sig.ip_hmac = None
    sig.confirmation_token = None
    sig.email_encrypted = "anonymized"
    sig.email_hash = "anonymized:" + uuid.uuid4().hex
    sig.anonymized_at = now


async def _anonymize_matching(db: AsyncSession, extra_filters: list, now: datetime) -> int:
    """Anonimiza en lotes las firmas no anonimizadas que cumplen `extra_filters`."""
    total = 0
    while True:
        stmt = select(Signature).where(
            Signature.anonymized_at.is_(None),
            *extra_filters,
        ).limit(_BATCH_SIZE)

        result = await db.execute(stmt)
        batch = result.scalars().all()
        if not batch:
            break

        sig_ids = [s.id for s in batch]
        for sig in batch:
            anonymize_signature(sig, now)

        consents_result = await db.execute(select(Consent).where(Consent.signature_id.in_(sig_ids)))
        for consent in consents_result.scalars().all():
            consent.ip_hmac = None

        await db.commit()
        total += len(batch)

        if len(batch) < _BATCH_SIZE:
            break

    return total


async def _anonymize_campaign_signatures(
    db: AsyncSession,
    campaign_id: uuid.UUID,
    cutoff: datetime | None,
    now: datetime,
) -> int:
    """Anonimiza en lotes las firmas no anonimizadas de la campaña que expiraron.

    `cutoff=None` significa que la campaña ya tiene ancla `entrega` vencida:
    todas sus firmas no anonimizadas expiraron. Si no, `cutoff` es la fecha
    límite de `created_at` (ancla por firma, R2).
    """
    filters = [Signature.campaign_id == campaign_id]
    if cutoff is not None:
        filters.append(Signature.created_at <= cutoff)
    return await _anonymize_matching(db, filters, now)


async def _purge_archived_signatures(db: AsyncSession, now: datetime) -> int:
    """Purga (anonimiza) firmas archivadas desde admin cuya ventana de 15 días venció (supresion-admin R8, R10)."""
    filters = [
        Signature.purge_after.is_not(None),
        Signature.purge_after <= now,
    ]
    return await _anonymize_matching(db, filters, now)


async def run_retention(db: AsyncSession, trigger: str) -> RetentionRun:
    """Evalúa todas las campañas con firmas no anonimizadas y purga las que expiraron (R1, R5, R6, R7)."""
    await db.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))

    now = datetime.now(timezone.utc)
    started_at = now

    campaign_ids_result = await db.execute(
        select(Signature.campaign_id).where(Signature.anonymized_at.is_(None)).distinct()
    )
    campaign_ids = [row[0] for row in campaign_ids_result.all()]

    detail = []
    signatures_anonymized = 0

    for campaign_id in campaign_ids:
        campaign = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
        if campaign is None:
            continue

        privacy_config = (
            await db.execute(select(PrivacyConfig).where(PrivacyConfig.campaign_id == campaign_id))
        ).scalar_one_or_none()
        if privacy_config is None:
            logger.warning("[retention] campaña %s sin privacy_config — usando default %s días", campaign_id, _DEFAULT_RETENTION_DAYS)
            retention_days = _DEFAULT_RETENTION_DAYS
        else:
            retention_days = privacy_config.retention_days

        anchor = await get_campaign_anchor(db, campaign_id)

        if anchor is not None:
            expiry = compute_expiry(anchor, retention_days)
            if expiry > now:
                continue
            cutoff = None  # todas las firmas no anonimizadas de la campaña expiraron
        else:
            cutoff = now - timedelta(days=retention_days)

        anonymized_count = await _anonymize_campaign_signatures(db, campaign_id, cutoff, now)
        if anonymized_count:
            signatures_anonymized += anonymized_count
            detail.append({"campaign_id": str(campaign_id), "anonymized_count": anonymized_count})

    # Cola de purga de firmas archivadas desde admin (supresion-admin R8) — mismo job, mismo mecanismo
    archived_purge_count = await _purge_archived_signatures(db, now)
    if archived_purge_count:
        signatures_anonymized += archived_purge_count
        detail.append({"archived_purge_count": archived_purge_count})

    run = RetentionRun(
        started_at=started_at,
        finished_at=datetime.now(timezone.utc),
        trigger=trigger,
        campaigns_evaluated=len(campaign_ids),
        signatures_anonymized=signatures_anonymized,
        detail=detail,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run
