"""Centro de comunicaciones — Fase 3: programación, cola multi-día e
historial (absorbe `programacion-historial-comunicaciones`).

No define transporte propio (R16/R17, igual que `comms_service`): resuelve
`config-email-org` por campaña, igual que el envío inmediato de Fase 1. El
loop asíncrono (R13) vive en `app/comms_scheduler_loop.py`; este módulo tiene
la lógica de negocio (CRUD de borradores/programados, expansión en lotes,
claim atómico, procesamiento respetando cuota, historial) para que el loop y
los endpoints la compartan sin duplicar.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign
from app.models.organization import Organization
from app.models.scheduled_send import ScheduledSend
from app.models.send_batch import SendBatch
from app.models.send_log import SendLog
from app.services.comms_service import (
    COMMS_TYPES, AudienceFilter, CtaButton, InvalidCommsType, build_comms_email_html, build_merge_context,
    count_recipients, get_recipient_data_by_ids, get_recipient_ids, render_merge_tags, sanitize_comms_html,
    unsubscribe_url_for,
)
from app.services.email_quota import PLATFORM_QUOTA_KEY, get_usage
from app.services.email_service import _send
from app.services.email_transport import platform_transport, resolve_sender, transport_from_config
from app.services.org_email_config_service import OrgEmailConfigService

logger = logging.getLogger(__name__)

# Tamaño de lote para planes sin tope diario conocido (p. ej. Resend Pro,
# daily_quota=None) — evita un único lote gigantesco; sigue permitiendo
# terminar en pocos ticks del loop.
_UNLIMITED_CHUNK_SIZE = 500


class SendNotCancellable(ValueError):
    pass


class DraftNotFound(ValueError):
    pass


async def _resolve_email_context(db: AsyncSession, campaign: Campaign, org: Organization | None):
    """Igual que `_resolve_campaign_email_context` en `routers/campaigns.py`
    — duplicado deliberadamente (10 líneas) para no crear un import inverso
    router→service (`campaigns.py` ya importa este módulo)."""
    cfg = await OrgEmailConfigService.get(db, campaign.org_id)
    active_cfg = cfg if (cfg and cfg.status == "active") else None
    transport = transport_from_config(active_cfg) if active_cfg else platform_transport()
    sender = resolve_sender(campaign.meta, active_cfg, org)
    quota_key = str(active_cfg.id) if active_cfg else PLATFORM_QUOTA_KEY
    caps = transport.capabilities()
    daily_quota = active_cfg.daily_quota if active_cfg and active_cfg.daily_quota is not None else caps.daily_quota
    return transport, sender, quota_key, daily_quota


# ── Borradores (R22) ──────────────────────────────────────────────────────

async def _upsert_scheduled_send(
    db: AsyncSession, *, org_id: uuid.UUID, campaign_id: uuid.UUID, draft_id: uuid.UUID | None,
    type: str, subject: str, heading: str = "", body_html: str = "", ctas: list[dict] | None = None, include_social: bool = False,
    audience: dict, created_by: uuid.UUID | None,
) -> ScheduledSend:
    """Arma en memoria, sin commit — building block compartido por
    `save_draft` y `schedule_send` para que ambos puedan agregar más cambios
    (p. ej. `status`/`scheduled_at`) y commitear **una sola vez** al final.
    Partir esto en dos transacciones separadas por un `commit()` intermedio
    expone al mismo riesgo de RLS+pool de conexiones que el bug de uploads:
    un autoflush posterior (p. ej. el de `count_recipients`) puede correr
    sobre una conexión física distinta a la que tenía el GUC de sesión."""
    if type not in COMMS_TYPES:
        raise InvalidCommsType(type)
    if draft_id is not None:
        draft = await db.get(ScheduledSend, draft_id)
        if draft is None or draft.campaign_id != campaign_id or draft.status != "draft":
            raise DraftNotFound(str(draft_id))
    else:
        draft = ScheduledSend(org_id=org_id, campaign_id=campaign_id, status="draft", created_by=created_by)

    draft.type = type
    draft.comms_class = COMMS_TYPES[type]
    draft.subject = subject
    draft.heading = heading
    draft.body_html = sanitize_comms_html(body_html)
    draft.ctas = ctas if ctas is not None else []
    draft.include_social = include_social
    draft.audience = audience
    db.add(draft)
    return draft


async def save_draft(
    db: AsyncSession, *, org_id: uuid.UUID, campaign_id: uuid.UUID, draft_id: uuid.UUID | None,
    type: str, subject: str, heading: str = "", body_html: str = "", ctas: list[dict] | None = None, include_social: bool = False,
    audience: dict, created_by: uuid.UUID | None,
) -> ScheduledSend:
    draft = await _upsert_scheduled_send(
        db, org_id=org_id, campaign_id=campaign_id, draft_id=draft_id, type=type, subject=subject,
        heading=heading, body_html=body_html, ctas=ctas, include_social=include_social, audience=audience,
        created_by=created_by,
    )
    await db.commit()
    return draft


async def list_drafts(db: AsyncSession, campaign_id: uuid.UUID) -> list[ScheduledSend]:
    result = await db.execute(
        select(ScheduledSend)
        .where(ScheduledSend.campaign_id == campaign_id, ScheduledSend.status == "draft")
        .order_by(ScheduledSend.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_draft(db: AsyncSession, campaign_id: uuid.UUID, draft_id: uuid.UUID) -> ScheduledSend | None:
    draft = await db.get(ScheduledSend, draft_id)
    if draft is None or draft.campaign_id != campaign_id or draft.status != "draft":
        return None
    return draft


async def delete_draft(db: AsyncSession, campaign_id: uuid.UUID, draft_id: uuid.UUID) -> bool:
    draft = await get_draft(db, campaign_id, draft_id)
    if draft is None:
        return False
    await db.delete(draft)
    await db.commit()
    return True


# ── Programar (R12) ───────────────────────────────────────────────────────

async def schedule_send(
    db: AsyncSession, *, org_id: uuid.UUID, campaign_id: uuid.UUID, draft_id: uuid.UUID | None,
    type: str, subject: str, heading: str = "", body_html: str = "", ctas: list[dict] | None = None, include_social: bool = False,
    audience: dict, scheduled_at: datetime, created_by: uuid.UUID | None,
) -> ScheduledSend:
    """Crea (o promueve un borrador a) un envío programado — `status=pending`
    hasta que el loop lo recoja al vencer `scheduled_at` (R13). Una sola
    transacción de principio a fin (ver `_upsert_scheduled_send`)."""
    send = await _upsert_scheduled_send(
        db, org_id=org_id, campaign_id=campaign_id, draft_id=draft_id, type=type, subject=subject,
        heading=heading, body_html=body_html, ctas=ctas, include_social=include_social, audience=audience,
        created_by=created_by,
    )
    send.status = "pending"
    send.scheduled_at = scheduled_at
    send.recipient_count = await count_recipients(db, campaign_id, type, AudienceFilter(**audience))
    db.add(send)
    await db.commit()
    return send


# ── Cola / cancelación (R13, R15) ─────────────────────────────────────────

async def list_queue(db: AsyncSession, campaign_id: uuid.UUID) -> list[ScheduledSend]:
    result = await db.execute(
        select(ScheduledSend)
        .where(ScheduledSend.campaign_id == campaign_id, ScheduledSend.status.in_(["pending", "sending"]))
        .order_by(ScheduledSend.scheduled_at.asc())
    )
    return list(result.scalars().all())


async def cancel_scheduled_send(db: AsyncSession, campaign_id: uuid.UUID, send_id: uuid.UUID) -> ScheduledSend:
    """R15: cancela mientras queden lotes `pending`; no se edita in-place."""
    send = await db.get(ScheduledSend, send_id)
    if send is None or send.campaign_id != campaign_id:
        raise DraftNotFound(str(send_id))
    if send.status not in ("pending", "sending"):
        raise SendNotCancellable(send.status)
    send.status = "cancelled"
    db.add(send)
    await db.execute(
        sa_update(SendBatch)
        .where(SendBatch.scheduled_send_id == send.id, SendBatch.status == "pending")
        .values(status="cancelled")
    )
    await db.commit()
    return send


# ── Historial (R14) ───────────────────────────────────────────────────────

async def log_send(
    db: AsyncSession, *, org_id: uuid.UUID, campaign_id: uuid.UUID, type: str, comms_class: str, subject: str,
    recipient_count: int, sent_count: int, failed_count: int, mode: str, trigger: str,
    triggered_by: uuid.UUID | None, scheduled_send_id: uuid.UUID | None = None,
) -> SendLog:
    log = SendLog(
        org_id=org_id, campaign_id=campaign_id, scheduled_send_id=scheduled_send_id, type=type,
        comms_class=comms_class, subject=subject, recipient_count=recipient_count, sent_count=sent_count,
        failed_count=failed_count, mode=mode, trigger=trigger, triggered_by=triggered_by,
    )
    db.add(log)
    await db.commit()
    return log


async def list_history(db: AsyncSession, campaign_id: uuid.UUID) -> list[SendLog]:
    result = await db.execute(
        select(SendLog).where(SendLog.campaign_id == campaign_id).order_by(SendLog.created_at.desc())
    )
    return list(result.scalars().all())


# ── Expansión en lotes + procesamiento (R13, D4) ──────────────────────────

async def expand_into_batches(db: AsyncSession, send: ScheduledSend, daily_quota: int | None) -> None:
    """Trocea el segmento en `send_batch` de a `daily_quota` (o un tope fijo
    si el plan no declara tope, p. ej. Pro) y pasa el envío a `sending`."""
    ids = await get_recipient_ids(db, send.campaign_id, send.type, AudienceFilter(**send.audience))
    send.recipient_count = len(ids)
    if not ids:
        send.status = "sent"
        db.add(send)
        await db.commit()
        # R14: registrar también el caso "0 destinatarios" — sin esto el
        # camino corto se saltaba el historial (solo `_finalize_if_done`,
        # que este camino nunca atraviesa, lo escribía).
        await log_send(
            db, org_id=send.org_id, campaign_id=send.campaign_id, type=send.type, comms_class=send.comms_class,
            subject=send.subject, recipient_count=0, sent_count=0, failed_count=0, mode="real",
            trigger="scheduled", triggered_by=send.created_by, scheduled_send_id=send.id,
        )
        return
    chunk_size = daily_quota if daily_quota and daily_quota > 0 else _UNLIMITED_CHUNK_SIZE
    for idx, start in enumerate(range(0, len(ids), chunk_size)):
        chunk = ids[start:start + chunk_size]
        db.add(SendBatch(
            scheduled_send_id=send.id, org_id=send.org_id, batch_index=idx,
            signature_ids=[str(i) for i in chunk], status="pending",
        ))
    send.status = "sending"
    db.add(send)
    await db.commit()


async def _claim_batch(db: AsyncSession, batch_id: uuid.UUID) -> bool:
    """Claim atómico (R13): solo una instancia del loop puede tomar el lote."""
    result = await db.execute(
        sa_update(SendBatch).where(SendBatch.id == batch_id, SendBatch.status == "pending").values(status="sending")
    )
    await db.commit()
    return result.rowcount == 1


async def _next_batch_index(db: AsyncSession, scheduled_send_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(SendBatch.batch_index), -1)).where(SendBatch.scheduled_send_id == scheduled_send_id)
    )
    return (result.scalar() or -1) + 1


async def _process_claimed_batch(
    db: AsyncSession, batch: SendBatch, send: ScheduledSend, transport, sender, quota_key: str, daily_quota: int | None,
) -> None:
    """Envía lo que quepa en la cuota restante de HOY; si el lote no cabe
    entero, envía lo posible y crea un lote nuevo `pending` con el resto
    (D4: "reprogramar el resto para el día siguiente")."""
    usage = await get_usage(quota_key)
    remaining = None if daily_quota is None else max(daily_quota - usage["daily_used"], 0)

    ids_all = [uuid.UUID(s) for s in batch.signature_ids]
    if remaining is not None and remaining <= 0:
        # Cuota agotada por hoy (posiblemente consumida por otro envío de la
        # misma org entre la expansión y este tick) — libera el claim, se
        # reintenta en un tick futuro.
        batch.status = "pending"
        db.add(batch)
        await db.commit()
        return

    ids_to_send = ids_all if remaining is None else ids_all[:remaining]
    remainder = [] if remaining is None else ids_all[remaining:]

    recipients = await get_recipient_data_by_ids(db, ids_to_send)
    ctas = [CtaButton(**c) for c in (send.ctas or [])]
    is_anuncios = send.comms_class == "anuncios"
    sent = 0
    failed = 0
    for r in recipients:
        tagged_body = render_merge_tags(send.body_html, build_merge_context(r))
        html = build_comms_email_html(
            org_name=sender.get("org_name", ""), org_logo_url=sender.get("org_logo_url", ""),
            heading=send.heading, body_html=tagged_body, ctas=ctas,
            include_social=send.include_social, social_links=sender.get("social_links"),
            unsubscribe_url=unsubscribe_url_for(r.signature_id) if is_anuncios else None,
        )
        ok = await _send(
            r.email, send.subject, html, transport=transport, from_=sender["from_"], reply_to=sender["reply_to"],
            quota_key=quota_key,
        )
        if ok:
            sent += 1
        else:
            failed += 1

    batch.sent_count = sent
    batch.failed_count = failed
    batch.sent_at = datetime.now(timezone.utc)
    batch.status = "sent"
    if remainder:
        batch.signature_ids = [str(i) for i in ids_to_send]
        next_idx = await _next_batch_index(db, send.id)
        db.add(SendBatch(
            scheduled_send_id=send.id, org_id=send.org_id, batch_index=next_idx,
            signature_ids=[str(i) for i in remainder], status="pending",
        ))
    db.add(batch)

    send.sent_count = (send.sent_count or 0) + sent
    send.failed_count = (send.failed_count or 0) + failed
    db.add(send)
    await db.commit()


async def _finalize_if_done(db: AsyncSession, send: ScheduledSend) -> None:
    """Solo cierra el envío si no queda ningún lote `pending` NI `sending` —
    un lote `sending` puede ser un tick concurrente todavía en curso (ver
    `_LOCK_TTL_SECONDS`), no equivale a "no hay más trabajo"."""
    result = await db.execute(
        select(func.count()).select_from(SendBatch)
        .where(SendBatch.scheduled_send_id == send.id, SendBatch.status.in_(["pending", "sending"]))
    )
    if (result.scalar() or 0) > 0:
        return
    if send.status == "cancelled":
        return
    send.status = "sent"
    db.add(send)
    await db.commit()
    await log_send(
        db, org_id=send.org_id, campaign_id=send.campaign_id, type=send.type, comms_class=send.comms_class,
        subject=send.subject, recipient_count=send.recipient_count, sent_count=send.sent_count,
        failed_count=send.failed_count, mode="real", trigger="scheduled", triggered_by=send.created_by,
        scheduled_send_id=send.id,
    )


async def process_due_scheduled_sends(db: AsyncSession) -> dict:
    """Un tick del loop (R13): expande los vencidos sin lotes todavía y
    procesa un lote reclamable por cada envío `sending`. Corre fuera de un
    request — sin GUC de org seteado, así que opera como platform_admin
    (mismo patrón que `retention_service`) para poder leer/escribir de
    cualquier organización."""
    from sqlalchemy import text
    await db.execute(text("SELECT set_config('app.is_platform_admin', 'true', true)"))

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(ScheduledSend).where(ScheduledSend.status == "pending", ScheduledSend.scheduled_at <= now)
    )
    due = list(result.scalars().all())
    expanded = 0
    for send in due:
        count_result = await db.execute(
            select(func.count()).select_from(SendBatch).where(SendBatch.scheduled_send_id == send.id)
        )
        if (count_result.scalar() or 0) > 0:
            continue
        campaign = await db.get(Campaign, send.campaign_id)
        org = await db.get(Organization, send.org_id)
        if campaign is None:
            continue
        _transport, _sender, _quota_key, daily_quota = await _resolve_email_context(db, campaign, org)
        await expand_into_batches(db, send, daily_quota)
        expanded += 1

    result = await db.execute(select(ScheduledSend).where(ScheduledSend.status == "sending"))
    sending = list(result.scalars().all())
    processed = 0
    for send in sending:
        campaign = await db.get(Campaign, send.campaign_id)
        org = await db.get(Organization, send.org_id)
        if campaign is None:
            continue
        transport, sender_ctx, quota_key, daily_quota = await _resolve_email_context(db, campaign, org)
        batch_id_result = await db.execute(
            select(SendBatch.id)
            .where(SendBatch.scheduled_send_id == send.id, SendBatch.status == "pending")
            .order_by(SendBatch.batch_index.asc())
            .limit(1)
        )
        batch_id = batch_id_result.scalar()
        if batch_id is None:
            await _finalize_if_done(db, send)
            continue
        if not await _claim_batch(db, batch_id):
            continue
        batch = await db.get(SendBatch, batch_id)
        sender = {
            "from_": sender_ctx["from_"], "reply_to": sender_ctx["reply_to"],
            "org_name": org.name if org else "", "org_logo_url": (org.logo_url or "") if org else "",
            "social_links": campaign.social_links,
        }
        try:
            await _process_claimed_batch(db, batch, send, transport, sender, quota_key, daily_quota)
        except Exception as exc:  # noqa: BLE001
            # R15: un lote fallido queda `failed` con el error, sin
            # reintento automático — no se reprograma ni se reencola.
            logger.exception("[comms_queue] lote %s falló, marcado failed sin reintento", batch.id)
            batch.status = "failed"
            batch.error = str(exc)[:500]
            db.add(batch)
            await db.commit()
        processed += 1
        await _finalize_if_done(db, send)

    return {"expanded": expanded, "batches_processed": processed}
