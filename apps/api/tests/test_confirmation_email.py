"""correo-recuperacion (hardening-campana T1.5): envío del correo de confirmación fuera de la petición.

El proveedor se simula parcheando `send_confirmation_email` DENTRO del servicio; las direcciones usan dominios
reservados (`.test`) para que, si un loop de desarrollo las viera, el envío real las descarte.
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import delete, select, text, update

from app.crypto import compute_hmac, encrypt_pii
from app.database import AsyncSessionLocal, set_rls_context
from app.models.campaign import Campaign
from app.models.consent import Consent
from app.models.organization import Organization
from app.models.signature import Signature
from app.models.user import User
from app.services import confirmation_email_service as svc

NOW = lambda: datetime.now(timezone.utc)  # noqa: E731


class FakeProvider:
    """Reemplaza `send_confirmation_email` del servicio. `results` se consume en orden; el último se repite."""

    def __init__(self, *results, delay: float = 0.0):
        self.results = list(results) or [True]
        self.calls: list[dict] = []
        self.delay = delay

    async def __call__(self, **kwargs):
        self.calls.append(kwargs)
        if self.delay:
            await asyncio.sleep(self.delay)
        r = self.results.pop(0) if len(self.results) > 1 else self.results[0]
        if isinstance(r, Exception):
            raise r
        return r


@pytest.fixture
def provider(monkeypatch):
    p = FakeProvider(True)
    monkeypatch.setattr(svc, "send_confirmation_email", p)
    return p


@pytest.fixture
async def mundo():
    """Fábrica de firmas pendientes en una organización/campaña propias, con limpieza al final."""
    creados: dict = {"sigs": []}
    async with AsyncSessionLocal() as db:
        await set_rls_context(db, platform_admin=True)
        s = uuid.uuid4().hex[:8]
        org = Organization(name=f"Org CE {s}", slug=f"org-ce-{s}", status="verificada", contact_email=f"c-{s}@org.test")
        db.add(org)
        await db.flush()
        user = User(org_id=org.id, email=f"a-{s}@org.test", password_hash="x", role="admin")
        db.add(user)
        await db.flush()
        camp = Campaign(org_id=org.id, created_by=user.id, title=f"Campaña {s}", slug=f"camp-ce-{s}", status="active")
        db.add(camp)
        await db.commit()
        creados.update(org=org, user=user, camp=camp)

    async def crear(visibility="publica", **over) -> uuid.UUID:
        async with AsyncSessionLocal() as db:
            await set_rls_context(db, platform_admin=True)
            email = f"f-{uuid.uuid4().hex[:8]}@firmante.test"
            valores = dict(
                campaign_id=camp.id, org_id=org.id, name="Ana Pérez Mora", email_encrypted=encrypt_pii(email),
                email_hash=compute_hmac(email), cedula_encrypted=encrypt_pii("1710034065"),
                celular_encrypted=encrypt_pii("0991234567"), provincia="Pichincha", visibility=visibility,
                status="pending_confirmation", ip_hmac=compute_hmac("127.0.0.1"),
                confirmation_token=uuid.uuid4().hex, confirmation_token_expires_at=NOW() + timedelta(hours=20),
                confirmation_email_status="pending", confirmation_email_next_at=NOW() - timedelta(seconds=1),
            )
            valores.update(over)
            sig = Signature(**valores)
            db.add(sig)
            await db.commit()
            creados["sigs"].append(sig.id)
            return sig.id

    creados["crear"] = crear
    yield creados
    async with AsyncSessionLocal() as db:
        await set_rls_context(db, platform_admin=True)
        await db.execute(delete(Consent).where(Consent.signature_id.in_(select(Signature.id).where(Signature.campaign_id == camp.id))))
        await db.execute(delete(Signature).where(Signature.campaign_id == camp.id))
        await db.execute(delete(Campaign).where(Campaign.id == camp.id))
        await db.execute(delete(User).where(User.org_id == org.id))
        await db.execute(delete(Organization).where(Organization.id == org.id))
        await db.commit()


async def _fila(sig_id) -> Signature:
    async with AsyncSessionLocal() as db:
        await set_rls_context(db, platform_admin=True)
        return (await db.execute(select(Signature).where(Signature.id == sig_id))).scalar_one()


async def _set(sig_id, **values):
    async with AsyncSessionLocal() as db:
        await set_rls_context(db, platform_admin=True)
        await db.execute(update(Signature).where(Signature.id == sig_id).values(**values))
        await db.commit()


# ── Éxito, visibilidades y contenido ────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("visibility", ["publica", "anonima", "secreta"])
async def test_envio_exitoso_en_las_tres_visibilidades(mundo, provider, visibility):
    sig_id = await mundo["crear"](visibility=visibility)
    assert await svc.attempt_send(sig_id) == "sent"
    fila = await _fila(sig_id)
    assert fila.confirmation_email_status == "sent" and fila.confirmation_email_attempts == 1
    assert fila.confirmation_email_sent_at is not None and fila.confirmation_email_next_at is None
    call = provider.calls[0]
    assert call["visibility"] == visibility
    assert call["token"] == fila.confirmation_token
    assert call["entered_name"] == "Ana Pérez Mora"
    assert call["entered_cedula_masked"] and "1710034065" not in call["entered_cedula_masked"]
    assert "/mis-datos/portal?token=" in call["arco_review_url"]


async def test_el_token_del_portal_arco_se_emite_nuevo_y_solo_se_guarda_su_hmac(mundo, provider):
    sig_id = await mundo["crear"]()
    await svc.attempt_send(sig_id)
    token = provider.calls[0]["arco_review_url"].split("token=")[1].split("&")[0]
    fila = await _fila(sig_id)
    assert fila.arco_verification_token == compute_hmac(token) != token


# ── Fallos, backoff y tope ──────────────────────────────────────────────────────────────────────────────────

async def test_fallo_programa_reintento_y_no_se_reintenta_antes_de_tiempo(mundo, monkeypatch):
    p = FakeProvider(False)
    monkeypatch.setattr(svc, "send_confirmation_email", p)
    sig_id = await mundo["crear"]()
    assert await svc.attempt_send(sig_id) == "failed"
    fila = await _fila(sig_id)
    assert fila.confirmation_email_status == "failed" and fila.confirmation_email_attempts == 1
    espera = (fila.confirmation_email_next_at - NOW()).total_seconds()
    assert 50 <= espera <= 61
    assert await svc.attempt_send(sig_id) == "skipped"  # aún no vence
    assert len(p.calls) == 1


async def test_excepcion_del_proveedor_es_reintentable(mundo, monkeypatch):
    monkeypatch.setattr(svc, "send_confirmation_email", FakeProvider(RuntimeError("timeout")))
    sig_id = await mundo["crear"]()
    assert await svc.attempt_send(sig_id) == "failed"
    assert (await _fila(sig_id)).confirmation_email_status == "failed"


@pytest.mark.parametrize("intentos_previos,espera_esperada", [(1, 300), (2, 900), (3, 3600), (4, 10800)])
async def test_el_backoff_crece(mundo, monkeypatch, intentos_previos, espera_esperada):
    monkeypatch.setattr(svc, "send_confirmation_email", FakeProvider(False))
    sig_id = await mundo["crear"](
        confirmation_email_status="failed", confirmation_email_attempts=intentos_previos,
    )
    assert await svc.attempt_send(sig_id) == "failed"
    espera = ((await _fila(sig_id)).confirmation_email_next_at - NOW()).total_seconds()
    assert espera_esperada - 10 <= espera <= espera_esperada + 1


async def test_el_tope_de_intentos_termina_en_gave_up(mundo, monkeypatch):
    monkeypatch.setattr(svc, "send_confirmation_email", FakeProvider(False))
    sig_id = await mundo["crear"](confirmation_email_status="failed", confirmation_email_attempts=5)
    assert await svc.attempt_send(sig_id) == "gave_up"
    fila = await _fila(sig_id)
    assert fila.confirmation_email_status == "gave_up" and fila.confirmation_email_next_at is None
    assert await svc.attempt_send(sig_id) == "skipped"  # no se vuelve a tocar


# ── Token vigente, estado de la firma ───────────────────────────────────────────────────────────────────────

async def test_token_vencido_se_renueva_antes_de_enviar(mundo, provider):
    viejo = uuid.uuid4().hex
    sig_id = await mundo["crear"](confirmation_token=viejo, confirmation_token_expires_at=NOW() - timedelta(hours=3))
    await svc.attempt_send(sig_id)
    fila = await _fila(sig_id)
    assert fila.confirmation_token != viejo and provider.calls[0]["token"] == fila.confirmation_token
    assert fila.confirmation_token_expires_at > NOW() + timedelta(hours=23)


async def test_token_a_punto_de_vencer_tambien_se_renueva(mundo, provider):
    viejo = uuid.uuid4().hex
    sig_id = await mundo["crear"](confirmation_token=viejo, confirmation_token_expires_at=NOW() + timedelta(minutes=20))
    await svc.attempt_send(sig_id)
    assert (await _fila(sig_id)).confirmation_token != viejo


async def test_token_vigente_se_conserva(mundo, provider):
    viejo = uuid.uuid4().hex
    sig_id = await mundo["crear"](confirmation_token=viejo, confirmation_token_expires_at=NOW() + timedelta(hours=20))
    await svc.attempt_send(sig_id)
    assert (await _fila(sig_id)).confirmation_token == viejo and provider.calls[0]["token"] == viejo


@pytest.mark.parametrize("cambio", [{"status": "confirmed"}, {"anulada_at": NOW()}])
async def test_firma_que_ya_no_corresponde_no_se_envia(mundo, provider, cambio):
    sig_id = await mundo["crear"](**cambio)
    assert await svc.attempt_send(sig_id) == "not_required"
    assert provider.calls == []
    assert (await _fila(sig_id)).confirmation_email_status == "not_required"


async def test_org_con_nombre_y_celular_en_el_resumen(mundo, provider):
    sig_id = await mundo["crear"](signer_type="org", org_name="Colectivo Río")
    await svc.attempt_send(sig_id)
    c = provider.calls[0]
    assert c["entered_org_name"] == "Colectivo Río" and c["entered_celular_masked"]
    assert "0991234567" not in c["entered_celular_masked"]


# ── Concurrencia y recuperación ─────────────────────────────────────────────────────────────────────────────

async def test_dos_intentos_simultaneos_envian_una_sola_vez(mundo, monkeypatch):
    p = FakeProvider(True, delay=0.2)
    monkeypatch.setattr(svc, "send_confirmation_email", p)
    sig_id = await mundo["crear"]()
    resultados = await asyncio.gather(*(svc.attempt_send(sig_id) for _ in range(6)))
    assert sorted(resultados) == ["sent"] + ["skipped"] * 5
    assert len(p.calls) == 1 and (await _fila(sig_id)).confirmation_email_attempts == 1


async def test_sending_caducado_se_recupera_y_el_reciente_no(mundo, provider):
    viejo = await mundo["crear"](confirmation_email_status="sending", confirmation_email_attempts=1,
                                 confirmation_email_claimed_at=NOW() - timedelta(minutes=10))
    reciente = await mundo["crear"](confirmation_email_status="sending", confirmation_email_attempts=1,
                                    confirmation_email_claimed_at=NOW() - timedelta(seconds=30))
    agotado = await mundo["crear"](confirmation_email_status="sending", confirmation_email_attempts=6,
                                   confirmation_email_claimed_at=NOW() - timedelta(minutes=10))
    async with AsyncSessionLocal() as db:
        await set_rls_context(db, platform_admin=True)
        assert await svc.recover_stale(db) >= 2
    assert (await _fila(viejo)).confirmation_email_status == "failed"
    assert (await _fila(reciente)).confirmation_email_status == "sending"
    assert (await _fila(agotado)).confirmation_email_status == "gave_up"


async def test_process_due_toma_lo_vencido_y_deja_lo_futuro(mundo, provider):
    pendiente = await mundo["crear"]()
    fallida = await mundo["crear"](confirmation_email_status="failed", confirmation_email_attempts=1,
                                   confirmation_email_next_at=NOW() - timedelta(seconds=5))
    futura = await mundo["crear"](confirmation_email_status="failed", confirmation_email_attempts=1,
                                  confirmation_email_next_at=NOW() + timedelta(hours=1))
    colgada = await mundo["crear"](confirmation_email_status="sending", confirmation_email_attempts=1,
                                   confirmation_email_claimed_at=NOW() - timedelta(minutes=9))
    await svc.process_due()
    assert (await _fila(pendiente)).confirmation_email_status == "sent"
    assert (await _fila(fallida)).confirmation_email_status == "sent"
    assert (await _fila(futura)).confirmation_email_status == "failed"
    # `sending` caducado: pasa a failed y se reintenta en el siguiente tick (next_at = ahora)
    assert (await _fila(colgada)).confirmation_email_status in ("failed", "sent")


async def test_limite_de_velocidad_deja_pendiente_lo_que_no_cabe(mundo, provider, monkeypatch):
    monkeypatch.setattr(svc.settings, "confirm_email_max_per_second", 1.0)
    svc._limits = None
    a, b, c = await mundo["crear"](), await mundo["crear"](), await mundo["crear"]()
    resultados = [await svc.attempt_send(i, max_wait=0.1) for i in (a, b, c)]
    assert resultados == ["sent", "skipped", "skipped"]
    assert (await _fila(b)).confirmation_email_status == "pending"  # lo recupera el loop


# ── Alta y reenvío por HTTP; aislamiento RLS ────────────────────────────────────────────────────────────────

async def test_el_alta_no_envia_en_la_peticion_y_deja_la_firma_pending(client, mundo, monkeypatch):
    from app.routers import public_campaign

    monkeypatch.setattr(public_campaign, "verify_turnstile", lambda token: _async_true())
    lanzados = []

    async def _fake_attempt(sig_id, **kw):
        lanzados.append(sig_id)

    monkeypatch.setattr(public_campaign, "attempt_send", _fake_attempt)
    llamadas = FakeProvider(True)
    monkeypatch.setattr(svc, "send_confirmation_email", llamadas)

    body = {
        "name": "Luis Mora Vega", "email": f"luis-{uuid.uuid4().hex[:6]}@firmante.test", "cedula": "1710034065",
        "signer_type": "natural", "location_mode": "nacional", "provincia": "Pichincha", "visibility": "secreta",
        "consent": True, "cf_turnstile_token": "x",
    }
    r = await client.post(f"/v1/public-campaign/{mundo['camp'].id}/signatures", json=body)
    assert r.status_code == 201, r.text[:300]
    sig_id = uuid.UUID(r.json()["id"])
    mundo["sigs"].append(sig_id)
    fila = await _fila(sig_id)
    assert fila.confirmation_email_status == "pending" and fila.confirmation_email_next_at is not None
    assert llamadas.calls == []  # el proveedor no se tocó dentro de la petición
    assert lanzados == [sig_id]  # y se encoló el intento inmediato


async def _async_true():
    return True


async def test_reenvio_manual_renueva_token_y_reencola(client, mundo, monkeypatch):
    from app.routers import public_campaign

    lanzados = []

    async def _fake_attempt(sig_id, **kw):
        lanzados.append(sig_id)

    monkeypatch.setattr(public_campaign, "attempt_send", _fake_attempt)
    email = f"reenvio-{uuid.uuid4().hex[:6]}@firmante.test"
    sig_id = await mundo["crear"](
        email_encrypted=encrypt_pii(email), email_hash=compute_hmac(email),
        confirmation_email_status="gave_up", confirmation_email_attempts=6, confirmation_email_next_at=None,
        confirmation_token_expires_at=NOW() - timedelta(hours=2),
    )
    r = await client.post(
        f"/v1/public-campaign/{mundo['camp'].id}/signatures/resend-confirmation", json={"email": email}
    )
    assert r.status_code == 204
    fila = await _fila(sig_id)
    assert fila.confirmation_email_status == "pending" and fila.confirmation_email_attempts == 0
    assert lanzados == [sig_id]
    # un correo desconocido responde igual y no encola nada
    r2 = await client.post(
        f"/v1/public-campaign/{mundo['camp'].id}/signatures/resend-confirmation", json={"email": "nadie@firmante.test"}
    )
    assert r2.status_code == 204 and lanzados == [sig_id]


async def test_el_recuperador_no_deja_contexto_rls_en_la_conexion(mundo, provider):
    sig_id = await mundo["crear"]()
    await svc.attempt_send(sig_id)
    async with AsyncSessionLocal() as db:
        v = (await db.execute(text("select current_setting('app.is_platform_admin', true)"))).scalar()
    assert v in (None, "")
