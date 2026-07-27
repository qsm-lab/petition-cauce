"""Tests de centro-comunicaciones Fase 2: sniffing de imagen por firma de
bytes (R19), guardado de uploads (tamaño/tipo) y aislamiento RLS entre
organizaciones (R18)."""
import base64
import os
import uuid

import pytest
from sqlalchemy import delete, text

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.campaign import Campaign
from app.models.comms_upload import CommsUpload
from app.models.organization import Organization
from app.models.user import User
from app.services.comms_service import UploadRejected, save_comms_upload, sniff_image

# PNG 1x1 transparente real (mismo usado para la verificación manual por HTTP
# de esta sesión) — firma de bytes válida de verdad, no solo el prefijo.
_VALID_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


# ── sniff_image: firma de bytes, sin DB ───────────────────────────────────

def test_sniff_image_png():
    assert sniff_image(_VALID_PNG) == ("png", "image/png")


def test_sniff_image_jpeg():
    assert sniff_image(b"\xff\xd8\xff" + b"\x00" * 20) == ("jpg", "image/jpeg")


def test_sniff_image_gif():
    assert sniff_image(b"GIF89a" + b"\x00" * 20) == ("gif", "image/gif")


def test_sniff_image_webp():
    data = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 10
    assert sniff_image(data) == ("webp", "image/webp")


def test_sniff_image_rechaza_svg():
    """R19: SVG (texto/XML) no tiene firma de bytes de ninguno de los 4
    formatos permitidos — queda rechazado sin lógica especial."""
    svg = b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"
    assert sniff_image(svg) is None


def test_sniff_image_rechaza_texto_plano():
    assert sniff_image(b"esto no es una imagen") is None


def test_sniff_image_rechaza_extension_disfrazada():
    """Bytes de texto plano con nombre .png no matchea la firma real (no se
    confía en la extensión declarada por el cliente)."""
    assert sniff_image(b"contenido cualquiera") is None


# ── save_comms_upload: validación + guardado en disco/DB ──────────────────

@pytest.fixture
async def db():
    async with AsyncSessionLocal() as session:
        await session.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
        yield session


async def _make_org(db) -> tuple[Organization, User]:
    suffix = uuid.uuid4().hex[:8]
    org = Organization(name=f"Org Upload {suffix}", slug=f"org-upload-{suffix}", status="verificada")
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
        title=f"Campaña Upload {suffix}", slug=f"camp-upload-{suffix}", status="active",
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


async def _cleanup(db, org, user, campaign):
    # Reafirmar el bypass de RLS: tras el commit()/checkout de conexión que
    # dispara abrir una sesión `scoped` en paralelo (el test de RLS de más
    # abajo), el pool de conexiones puede devolverle a `db` una conexión
    # distinta a la que tenía is_platform_admin seteado — no asumir que
    # persiste, igual que hace get_db_with_org por request en producción.
    await db.execute(text("SELECT set_config('app.is_platform_admin', 'true', false)"))
    await db.execute(delete(CommsUpload).where(CommsUpload.campaign_id == campaign.id))
    await db.execute(delete(Campaign).where(Campaign.id == campaign.id))
    await db.execute(delete(User).where(User.id == user.id))
    await db.execute(delete(Organization).where(Organization.id == org.id))
    await db.commit()


@pytest.mark.asyncio
async def test_save_comms_upload_rechaza_tipo_invalido(db, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "uploads_dir", str(tmp_path))
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        with pytest.raises(UploadRejected) as exc:
            await save_comms_upload(db, org_id=org.id, campaign_id=campaign.id, data=b"no es una imagen", created_by=user.id)
        assert exc.value.reason == "invalid_type"
    finally:
        await _cleanup(db, org, user, campaign)


@pytest.mark.asyncio
async def test_save_comms_upload_rechaza_tamano_excesivo(db, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "uploads_dir", str(tmp_path))
    monkeypatch.setattr(settings, "comms_upload_max_bytes", 10)  # límite chico para forzar el rechazo
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        with pytest.raises(UploadRejected) as exc:
            await save_comms_upload(db, org_id=org.id, campaign_id=campaign.id, data=_VALID_PNG, created_by=user.id)
        assert exc.value.reason == "too_large"
    finally:
        await _cleanup(db, org, user, campaign)


@pytest.mark.asyncio
async def test_save_comms_upload_guarda_archivo_y_fila(db, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "uploads_dir", str(tmp_path))
    org, user = await _make_org(db)
    campaign = await _make_campaign(db, org, user)
    try:
        upload = await save_comms_upload(db, org_id=org.id, campaign_id=campaign.id, data=_VALID_PNG, created_by=user.id)
        assert upload.mime == "image/png"
        assert upload.bytes == len(_VALID_PNG)
        assert upload.path.startswith(f"{org.id}/{campaign.id}/")
        assert upload.path.endswith(".png")

        abs_path = os.path.join(str(tmp_path), upload.path)
        assert os.path.isfile(abs_path)
        with open(abs_path, "rb") as f:
            assert f.read() == _VALID_PNG
    finally:
        await _cleanup(db, org, user, campaign)


# ── RLS: aislamiento entre organizaciones (R18) ────────────────────────────

@pytest.mark.asyncio
async def test_rls_aisla_uploads_entre_organizaciones(db, tmp_path, monkeypatch):
    """Una sesión scoped a la org A (sin is_platform_admin) nunca ve los
    uploads de la org B, aunque ambos existan en la misma tabla."""
    monkeypatch.setattr(settings, "uploads_dir", str(tmp_path))
    org_a, user_a = await _make_org(db)
    campaign_a = await _make_campaign(db, org_a, user_a)
    org_b, user_b = await _make_org(db)
    campaign_b = await _make_campaign(db, org_b, user_b)
    try:
        await save_comms_upload(db, org_id=org_a.id, campaign_id=campaign_a.id, data=_VALID_PNG, created_by=user_a.id)
        await save_comms_upload(db, org_id=org_b.id, campaign_id=campaign_b.id, data=_VALID_PNG, created_by=user_b.id)

        async with AsyncSessionLocal() as scoped:
            # is_local=true (SET LOCAL): estos GUCs se revierten solos al
            # cerrar la transacción de esta sesión — is_local=false (como usa
            # get_db_with_org en producción, donde cada request los pisa al
            # inicio) contaminaría la conexión física al devolverla al pool,
            # rompiendo tests posteriores que reutilicen esa misma conexión.
            await scoped.execute(text("SELECT set_config('app.is_platform_admin', 'false', true)"))
            await scoped.execute(text("SELECT set_config('app.current_org_id', :oid, true)"), {"oid": str(org_a.id)})
            rows = (await scoped.execute(text("SELECT org_id FROM comms_upload"))).all()
            assert len(rows) == 1
            assert str(rows[0][0]) == str(org_a.id)
    finally:
        await _cleanup(db, org_a, user_a, campaign_a)
        await _cleanup(db, org_b, user_b, campaign_b)
