"""Tests de centro-comunicaciones Fase 3: borradores (R22), programación (R12),
cancelación (R15), expansión/reparto por cuota (R13, D4) e historial (R14).
Transporte falso (mismo patrón que test_email_quota.py) — no golpea Resend."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import delete, select, text

from app.crypto import compute_hmac, encrypt_pii
from app.database import AsyncSessionLocal
from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.organization import Organization
from app.models.scheduled_send import ScheduledSend
from app.models.send_batch import SendBatch
from app.models.send_log import SendLog
from app.models.signature import Signature
from app.models.user import User
from app.redis_client import close_redis, get_redis, init_redis
from app.services import comms_queue_service
from app.services.comms_queue_service import (
    DraftNotFound, SendNotCancellable, _claim_batch, _finalize_if_done, _process_claimed_batch,
    cancel_scheduled_send, delete_draft, expand_into_batches, get_draft, list_drafts, list_history, list_queue,
    process_due_scheduled_sends, save_draft, schedule_send,
)
from app.services.email_quota import record_usage
from app.services.email_transport import EmailMessage, SendResult


class _FakeTransport:
    def __init__(self, ok: bool = True, raise_on: int | None = None):
        self.sent: list[EmailMessage] = []
        self._ok = ok
        self._raise_on = raise_on  # índice (0-based) del envío que debe lanzar excepción

    async def send(self, msg: EmailMessage) -> SendResult:
        idx = len(self.sent)
        self.sent.append(msg)
        if self._raise_on is not None and idx == self._raise_on:
            raise RuntimeError("fallo simulado del transporte")
        return SendResult(ok=self._ok)

    def capabilities(self):
        raise NotImplementedError


@pytest.fixture
async def db():
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        yield session


@pytest.fixture
async def redis_ctx():
    await init_redis()
    yield
    await close_redis()


async def _make_org(db) -> tuple[Organization, User]:
    suffix = uuid.uuid4().hex[:8]
    org = Organization(name=f"Org Sched {suffix}", slug=f"org-sched-{suffix}", status="verificada")
    db.add(org)
    await db.flush()
    user = User(org_id=org.id, email=f"admin-{suffix}@test.local", password_hash="x", role="admin")
    db.add(user)
    await db.commit()
    return org, user


async def _make_campaign(db, org: Organization, user: User) -> Campaign:
    suffix = uuid.uuid4().hex[:8]
    campaign = Campaign(
        org_id=org.id, created_by=user.id,
        title=f"Campaña Sched {suffix}", slug=f"camp-sched-{suffix}", status="active",
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def _make_signature(db, campaign: Campaign, org: Organization, *, notify_updates: bool = True) -> Signature:
    email = f"{uuid.uuid4().hex[:10]}@test.local"
    sig = Signature(
        campaign_id=campaign.id, org_id=org.id, name="Firmante Test",
        email_encrypted=encrypt_pii(email), email_hash=compute_hmac(email),
        visibility="publica", status="confirmed", signer_type="natural",
        confirmation_token=uuid.uuid4().hex, ip_hmac=compute_hmac("127.0.0.1"),
    )
    db.add(sig)
    await db.flush()
    consent = Consent(
        signature_id=sig.id, campaign_id=campaign.id, org_id=org.id,
        text_snapshot="aviso", version="1", legal_basis="consentimiento_expreso",
        notify_updates=notify_updates,
    )
    db.add(consent)
    await db.commit()
    await db.refresh(sig)
    return sig


async def _cleanup(db, org, user, campaign):
    await db.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
    send_ids = [row[0] for row in (await db.execute(
        text("SELECT id FROM scheduled_send WHERE campaign_id = :cid"), {"cid": str(campaign.id)}
    )).all()]
    if send_ids:
        await db.execute(delete(SendBatch).where(SendBatch.scheduled_send_id.in_(send_ids)))
    await db.execute(delete(SendLog).where(SendLog.campaign_id == campaign.id))
    await db.execute(delete(ScheduledSend).where(ScheduledSend.campaign_id == campaign.id))
    sig_ids = [row[0] for row in (await db.execute(
        text("SELECT id FROM signatures WHERE campaign_id = :cid"), {"cid": str(campaign.id)}
    )).all()]
    if sig_ids:
        await db.execute(delete(Consent).where(Consent.signature_id.in_(sig_ids)))
        await db.execute(delete(Signature).where(Signature.campaign_id == campaign.id))
    await db.execute(delete(Campaign).where(Campaign.id == campaign.id))
    await db.execute(delete(User).where(User.id == user.id))
    await db.execute(delete(Organization).where(Organization.id == org.id))
    await db.commit()


def _fake_context(transport, daily_quota, quota_key):
    async def _fn(db, campaign, org):
        return transport, {"from_": "test@cauce.ec", "reply_to": None}, quota_key, daily_quota
    return _fn


# ── Borradores (R22) ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_save_draft_crea_y_actualiza_en_lugar(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        draft = await save_draft(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="Asunto 1", body_html="<p>uno</p>", ctas=[], include_social=False,
            audience={}, created_by=user.id,
        )
        assert draft.status == "draft"
        assert draft.subject == "Asunto 1"

        updated = await save_draft(
            db, org_id=org.id, campaign_id=camp.id, draft_id=draft.id, type="general",
            subject="Asunto 2", body_html="<p>dos</p>", ctas=[], include_social=False,
            audience={}, created_by=user.id,
        )
        assert updated.id == draft.id
        assert updated.subject == "Asunto 2"

        drafts = await list_drafts(db, camp.id)
        assert len(drafts) == 1
        assert drafts[0].subject == "Asunto 2"
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_delete_draft_lo_elimina(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        draft = await save_draft(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="A borrar", body_html="", ctas=[], include_social=False, audience={}, created_by=user.id,
        )
        ok = await delete_draft(db, camp.id, draft.id)
        assert ok is True
        assert await get_draft(db, camp.id, draft.id) is None
        assert await delete_draft(db, camp.id, draft.id) is False
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_save_draft_con_id_inexistente_lanza_error(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        with pytest.raises(DraftNotFound):
            await save_draft(
                db, org_id=org.id, campaign_id=camp.id, draft_id=uuid.uuid4(), type="general",
                subject="x", body_html="", ctas=[], include_social=False, audience={}, created_by=user.id,
            )
    finally:
        await _cleanup(db, org, user, camp)


# ── Programación (R12) y cancelación (R15) ─────────────────────────────────

@pytest.mark.asyncio
async def test_schedule_send_promueve_borrador_a_pending(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        await _make_signature(db, camp, org, notify_updates=True)
        draft = await save_draft(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="Programado", body_html="<p>x</p>", ctas=[], include_social=False,
            audience={}, created_by=user.id,
        )
        when = datetime.now(timezone.utc) + timedelta(days=1)
        send = await schedule_send(
            db, org_id=org.id, campaign_id=camp.id, draft_id=draft.id, type="general",
            subject="Programado", body_html="<p>x</p>", ctas=[], include_social=False,
            audience={}, scheduled_at=when, created_by=user.id,
        )
        assert send.id == draft.id
        assert send.status == "pending"
        assert send.recipient_count == 1

        queue = await list_queue(db, camp.id)
        assert len(queue) == 1
        assert queue[0].id == send.id
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_cancel_frena_lotes_pending(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        await _make_signature(db, camp, org, notify_updates=True)
        send = await schedule_send(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="x", body_html="<p>x</p>", ctas=[], include_social=False,
            audience={}, scheduled_at=datetime.now(timezone.utc), created_by=user.id,
        )
        await expand_into_batches(db, send, daily_quota=100)
        assert send.status == "sending"

        cancelled = await cancel_scheduled_send(db, camp.id, send.id)
        assert cancelled.status == "cancelled"

        result = await db.execute(select(SendBatch).where(SendBatch.scheduled_send_id == send.id))
        batches = result.scalars().all()
        assert all(b.status == "cancelled" for b in batches)
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_cancel_falla_si_ya_no_es_cancelable(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        send = await save_draft(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="x", body_html="", ctas=[], include_social=False, audience={}, created_by=user.id,
        )
        # Un borrador (status=draft) no está en (pending, sending) -> no cancelable
        with pytest.raises(SendNotCancellable):
            await cancel_scheduled_send(db, camp.id, send.id)
    finally:
        await _cleanup(db, org, user, camp)


# ── Expansión en lotes (R13, D4) ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_expand_into_batches_trocea_por_cuota_diaria(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        for _ in range(5):
            await _make_signature(db, camp, org, notify_updates=True)
        send = await schedule_send(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="x", body_html="<p>x</p>", ctas=[], include_social=False,
            audience={}, scheduled_at=datetime.now(timezone.utc), created_by=user.id,
        )
        await expand_into_batches(db, send, daily_quota=2)
        assert send.status == "sending"
        assert send.recipient_count == 5

        result = await db.execute(
            select(SendBatch).where(SendBatch.scheduled_send_id == send.id).order_by(SendBatch.batch_index)
        )
        batches = result.scalars().all()
        assert [len(b.signature_ids) for b in batches] == [2, 2, 1]
        assert all(b.status == "pending" for b in batches)
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_expand_sin_destinatarios_marca_sent_directo(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        send = await schedule_send(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="x", body_html="<p>x</p>", ctas=[], include_social=False,
            audience={}, scheduled_at=datetime.now(timezone.utc), created_by=user.id,
        )
        await expand_into_batches(db, send, daily_quota=100)
        assert send.status == "sent"
        result = await db.execute(select(SendBatch).where(SendBatch.scheduled_send_id == send.id))
        assert result.scalars().all() == []

        # R14: el camino corto (0 destinatarios) también debe quedar en el
        # historial — no solo el camino normal vía _finalize_if_done.
        history = await list_history(db, camp.id)
        assert len(history) == 1
        assert history[0].recipient_count == 0
        assert history[0].trigger == "scheduled"
    finally:
        await _cleanup(db, org, user, camp)


# ── Claim atómico (R13) ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_claim_atomico_no_duplica(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        await _make_signature(db, camp, org, notify_updates=True)
        send = await schedule_send(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="x", body_html="<p>x</p>", ctas=[], include_social=False,
            audience={}, scheduled_at=datetime.now(timezone.utc), created_by=user.id,
        )
        await expand_into_batches(db, send, daily_quota=100)
        result = await db.execute(select(SendBatch.id).where(SendBatch.scheduled_send_id == send.id))
        batch_id = result.scalar()

        first = await _claim_batch(db, batch_id)
        second = await _claim_batch(db, batch_id)
        assert first is True
        assert second is False
    finally:
        await _cleanup(db, org, user, camp)


# ── Procesamiento de un lote + reparto multi-día (R13, D4) ──────────────────

@pytest.mark.asyncio
async def test_process_claimed_batch_envia_todo_si_hay_cuota(db, redis_ctx):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        for _ in range(3):
            await _make_signature(db, camp, org, notify_updates=True)
        send = await schedule_send(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="x", body_html="<p>x</p>", ctas=[], include_social=False,
            audience={}, scheduled_at=datetime.now(timezone.utc), created_by=user.id,
        )
        await expand_into_batches(db, send, daily_quota=100)
        result = await db.execute(select(SendBatch).where(SendBatch.scheduled_send_id == send.id))
        batch = result.scalars().first()
        await _claim_batch(db, batch.id)
        await db.refresh(batch)

        quota_key = f"test-{uuid.uuid4().hex[:8]}"
        transport = _FakeTransport(ok=True)
        sender = {"from_": "test@cauce.ec", "reply_to": None, "org_name": "Org", "org_logo_url": "",
                   "heading": "Novedades", "social_links": {}}
        await _process_claimed_batch(db, batch, send, transport, sender, quota_key, daily_quota=100)

        assert batch.status == "sent"
        assert batch.sent_count == 3
        assert len(transport.sent) == 3
        assert send.sent_count == 3
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_process_claimed_batch_reparte_resto_si_excede_cuota(db, redis_ctx):
    """D4: si el lote no cabe entero en la cuota restante de hoy, envía lo
    posible y crea un lote nuevo `pending` con el resto (reprograma para
    mañana, sin perder destinatarios)."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        for _ in range(5):
            await _make_signature(db, camp, org, notify_updates=True)
        send = await schedule_send(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="x", body_html="<p>x</p>", ctas=[], include_social=False,
            audience={}, scheduled_at=datetime.now(timezone.utc), created_by=user.id,
        )
        await expand_into_batches(db, send, daily_quota=100)  # un solo lote de 5
        result = await db.execute(select(SendBatch).where(SendBatch.scheduled_send_id == send.id))
        batch = result.scalars().first()
        await _claim_batch(db, batch.id)
        await db.refresh(batch)

        quota_key = f"test-{uuid.uuid4().hex[:8]}"
        await record_usage(quota_key, sent_count=98)  # deja solo 2 de cupo en un daily_quota=100
        transport = _FakeTransport(ok=True)
        sender = {"from_": "test@cauce.ec", "reply_to": None, "org_name": "Org", "org_logo_url": "",
                   "heading": "Novedades", "social_links": {}}
        await _process_claimed_batch(db, batch, send, transport, sender, quota_key, daily_quota=100)

        assert batch.status == "sent"
        assert batch.sent_count == 2
        assert len(transport.sent) == 2

        result = await db.execute(
            select(SendBatch).where(SendBatch.scheduled_send_id == send.id, SendBatch.status == "pending")
        )
        remainder_batches = result.scalars().all()
        assert len(remainder_batches) == 1
        assert len(remainder_batches[0].signature_ids) == 3
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_lote_fallido_queda_failed_sin_reintento(db, redis_ctx, monkeypatch):
    """R15: si el envío del lote lanza una excepción inesperada, el lote
    queda `failed` con el error — el loop no lo reintenta automáticamente."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        await _make_signature(db, camp, org, notify_updates=True)
        send = await schedule_send(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="x", body_html="<p>x</p>", ctas=[], include_social=False,
            audience={}, scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=1), created_by=user.id,
        )
        quota_key = f"test-{uuid.uuid4().hex[:8]}"
        transport = _FakeTransport(ok=True, raise_on=0)
        monkeypatch.setattr(comms_queue_service, "_resolve_email_context", _fake_context(transport, 100, quota_key))

        await process_due_scheduled_sends(db)

        result = await db.execute(select(SendBatch).where(SendBatch.scheduled_send_id == send.id))
        batches = result.scalars().all()
        assert len(batches) == 1
        assert batches[0].status == "failed"
        assert "fallo simulado" in batches[0].error

        # El envío igual se da por terminado (sin reintento): no queda pending.
        result = await db.execute(select(ScheduledSend).where(ScheduledSend.id == send.id))
        refreshed = result.scalar_one()
        assert refreshed.status == "sent"
    finally:
        await _cleanup(db, org, user, camp)


# ── Flujo completo del loop + historial (R13, R14) ──────────────────────────

@pytest.mark.asyncio
async def test_process_due_scheduled_sends_flujo_completo_escribe_historial(db, redis_ctx, monkeypatch):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        for _ in range(2):
            await _make_signature(db, camp, org, notify_updates=True)
        send = await schedule_send(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="Ya vencido", body_html="<p>x</p>", ctas=[], include_social=False,
            audience={}, scheduled_at=datetime.now(timezone.utc) - timedelta(minutes=5), created_by=user.id,
        )
        quota_key = f"test-{uuid.uuid4().hex[:8]}"
        transport = _FakeTransport(ok=True)
        monkeypatch.setattr(comms_queue_service, "_resolve_email_context", _fake_context(transport, 100, quota_key))

        result = await process_due_scheduled_sends(db)
        assert result["expanded"] == 1
        assert result["batches_processed"] == 1

        db_result = await db.execute(select(ScheduledSend).where(ScheduledSend.id == send.id))
        refreshed = db_result.scalar_one()
        assert refreshed.status == "sent"
        assert refreshed.sent_count == 2

        history = await list_history(db, camp.id)
        assert len(history) == 1
        assert history[0].trigger == "scheduled"
        assert history[0].mode == "real"
        assert history[0].recipient_count == 2
        assert history[0].sent_count == 2
        # R14: el historial no persiste contenido/HTML — solo metadatos.
        assert not hasattr(history[0], "body_html")
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_finalize_no_cierra_si_queda_lote_sending(db):
    """Regresión de incidente de producción (sesión 42): dos ticks
    concurrentes del loop pueden dejar más de un lote en `sending` a la vez
    (TTL del lock corto frente a un lote lento). `_finalize_if_done` debía
    mirar solo `pending` y por eso cerraba el envío como completo mientras
    otro lote seguía genuinamente en curso — 622 destinatarios reales
    quedaron sin correo antes de detectarse."""
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        send = await schedule_send(
            db, org_id=org.id, campaign_id=camp.id, draft_id=None, type="general",
            subject="x", body_html="<p>x</p>", ctas=[], include_social=False,
            audience={}, scheduled_at=datetime.now(timezone.utc), created_by=user.id,
        )
        send.status = "sending"
        db.add(send)
        db.add(SendBatch(
            scheduled_send_id=send.id, org_id=org.id, batch_index=0,
            signature_ids=["11111111-1111-1111-1111-111111111111"], status="sent", sent_count=1,
        ))
        sending_batch = SendBatch(
            scheduled_send_id=send.id, org_id=org.id, batch_index=1,
            signature_ids=["22222222-2222-2222-2222-222222222222"], status="sending",
        )
        db.add(sending_batch)
        await db.commit()

        await _finalize_if_done(db, send)
        db_result = await db.execute(select(ScheduledSend).where(ScheduledSend.id == send.id))
        assert db_result.scalar_one().status == "sending", "no debe cerrarse con un lote todavía en sending"

        sending_batch.status = "sent"
        sending_batch.sent_count = 1
        db.add(sending_batch)
        await db.commit()

        await _finalize_if_done(db, send)
        db_result = await db.execute(select(ScheduledSend).where(ScheduledSend.id == send.id))
        assert db_result.scalar_one().status == "sent", "sí debe cerrarse una vez que no queda pending ni sending"
    finally:
        await _cleanup(db, org, user, camp)


# ── RLS: aislamiento entre organizaciones (R18) ──────────────────────────────

@pytest.mark.asyncio
async def test_rls_aisla_scheduled_send_entre_organizaciones(db):
    org_a, user_a = await _make_org(db)
    camp_a = await _make_campaign(db, org_a, user_a)
    org_b, user_b = await _make_org(db)
    camp_b = await _make_campaign(db, org_b, user_b)
    try:
        await save_draft(
            db, org_id=org_a.id, campaign_id=camp_a.id, draft_id=None, type="general",
            subject="A", body_html="", ctas=[], include_social=False, audience={}, created_by=user_a.id,
        )
        await save_draft(
            db, org_id=org_b.id, campaign_id=camp_b.id, draft_id=None, type="general",
            subject="B", body_html="", ctas=[], include_social=False, audience={}, created_by=user_b.id,
        )

        async with AsyncSessionLocal() as scoped:
            await scoped.execute(text("SELECT set_config('app.is_platform_admin', 'false', true)"))
            await scoped.execute(text("SELECT set_config('app.current_org_id', :oid, true)"), {"oid": str(org_a.id)})
            rows = (await scoped.execute(text("SELECT org_id FROM scheduled_send"))).all()
            assert len(rows) == 1
            assert str(rows[0][0]) == str(org_a.id)
    finally:
        await _cleanup(db, org_a, user_a, camp_a)
        await _cleanup(db, org_b, user_b, camp_b)
