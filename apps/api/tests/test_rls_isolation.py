"""hardening-campana R3 / T2.1: aislamiento entre organizaciones (RLS) como `petition_app`.

Se ejecuta con la conexión real de la app (sin superusuario ni BYPASSRLS). Cubre lectura,
escritura cruzada, inserción en nombre de otra organización y contexto vacío (fail-closed).
"""
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import delete, select, text, update
from sqlalchemy.exc import DBAPIError

from app.crypto import compute_hmac, encrypt_pii
from app.database import AsyncSessionLocal, set_rls_context
from app.models.campaign import Campaign
from app.models.organization import Organization
from app.models.signature import Signature
from app.models.user import User


async def _as_org(session, org_id):
    await set_rls_context(session, org_id=org_id, platform_admin=False)


async def _make_org(db):
    s = uuid.uuid4().hex[:8]
    org = Organization(name=f"Org RLS {s}", slug=f"org-rls-{s}", status="verificada",
                       contact_email=f"c-{s}@test.local")
    db.add(org)
    await db.flush()
    user = User(org_id=org.id, email=f"a-{s}@test.local", password_hash="x", role="admin")
    db.add(user)
    await db.flush()
    camp = Campaign(org_id=org.id, created_by=user.id, title=f"C {s}", slug=f"c-{s}", status="active")
    db.add(camp)
    await db.flush()
    email = f"f-{s}@test.local"
    sig = Signature(
        campaign_id=camp.id, org_id=org.id, name="Firmante", email_encrypted=encrypt_pii(email),
        email_hash=compute_hmac(email), provincia="Pichincha", country="Ecuador",
        visibility="publica", status="confirmed", confirmed_at=datetime.now(timezone.utc),
        ip_hmac=compute_hmac("127.0.0.1"), confirmation_token=uuid.uuid4().hex,
    )
    db.add(sig)
    await db.commit()
    return org, camp, sig


@pytest.fixture
async def dos_orgs():
    async with AsyncSessionLocal() as db:
        await set_rls_context(db, platform_admin=True)
        a = await _make_org(db)
        b = await _make_org(db)
        yield a, b
        await db.rollback()
        await set_rls_context(db, platform_admin=True)
        for org, camp, sig in (a, b):
            await db.execute(delete(Signature).where(Signature.id == sig.id))
            await db.execute(delete(Campaign).where(Campaign.id == camp.id))
            await db.execute(delete(User).where(User.org_id == org.id))
            await db.execute(delete(Organization).where(Organization.id == org.id))
        await db.commit()


async def test_la_app_no_es_superusuario_ni_bypassrls_ni_duena():
    async with AsyncSessionLocal() as s:
        row = (await s.execute(text(
            "select rolsuper, rolbypassrls from pg_roles where rolname = current_user"))).one()
        assert row.rolsuper is False and row.rolbypassrls is False
        owner = (await s.execute(text(
            "select tableowner from pg_tables where schemaname='public' and tablename='signatures'"
        ))).scalar_one()
        current = (await s.execute(text("select current_user"))).scalar_one()
        assert owner != current, "la app es dueña de las tablas: RLS no la limitaría sin FORCE"


async def test_no_ve_firmas_ni_campanas_de_otra_organizacion(dos_orgs):
    (org_a, camp_a, sig_a), (org_b, camp_b, sig_b) = dos_orgs
    async with AsyncSessionLocal() as s:
        await _as_org(s, org_a.id)
        ids = {r for r in (await s.execute(select(Signature.id))).scalars()}
        assert sig_a.id in ids and sig_b.id not in ids
        assert (await s.execute(select(Signature).where(Signature.campaign_id == camp_b.id))).first() is None
        campaigns = {r for r in (await s.execute(select(Campaign.id))).scalars()}
        assert camp_a.id in campaigns and camp_b.id not in campaigns


async def test_no_puede_modificar_ni_borrar_firmas_ajenas(dos_orgs):
    (org_a, _, _), (_, _, sig_b) = dos_orgs
    async with AsyncSessionLocal() as s:
        await _as_org(s, org_a.id)
        upd = await s.execute(update(Signature).where(Signature.id == sig_b.id).values(status="anulada"))
        dele = await s.execute(delete(Signature).where(Signature.id == sig_b.id))
        assert upd.rowcount == 0 and dele.rowcount == 0
        await s.rollback()
    async with AsyncSessionLocal() as s:
        await set_rls_context(s, platform_admin=True)
        assert (await s.get(Signature, sig_b.id)).status == "confirmed"


async def test_no_puede_insertar_firma_a_nombre_de_otra_organizacion(dos_orgs):
    (org_a, _, _), (org_b, camp_b, _) = dos_orgs
    async with AsyncSessionLocal() as s:
        await _as_org(s, org_a.id)
        email = f"x-{uuid.uuid4().hex[:6]}@test.local"
        s.add(Signature(
            campaign_id=camp_b.id, org_id=org_b.id, name="Intruso",
            email_encrypted=encrypt_pii(email), email_hash=compute_hmac(email),
            visibility="publica", status="confirmed", ip_hmac=compute_hmac("1.1.1.1"),
            confirmation_token=uuid.uuid4().hex,
        ))
        with pytest.raises(DBAPIError):
            await s.commit()


async def test_sin_contexto_nunca_ve_firmas_secretas_ni_anuladas(dos_orgs):
    """Sin contexto de organización rigen solo las políticas públicas (feed y confirmación
    por token): una firma secreta o anulada no se ve, aunque esté confirmada."""
    (_, _, sig_a), (_, _, sig_b) = dos_orgs
    async with AsyncSessionLocal() as admin:
        await set_rls_context(admin, platform_admin=True)
        await admin.execute(update(Signature).where(Signature.id == sig_a.id).values(visibility="secreta"))
        await admin.execute(update(Signature).where(Signature.id == sig_b.id).values(status="anulada"))
        await admin.commit()
    async with AsyncSessionLocal() as s:
        await _as_org(s, None)
        ids = {r for r in (await s.execute(select(Signature.id))).scalars()}
        assert sig_a.id not in ids and sig_b.id not in ids
