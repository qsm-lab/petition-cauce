"""revision-datos-al-firmar R14–R19: nombre y apellido separados.

`name` sigue siendo el nombre completo compuesto; `first_name`/`last_name` solo existen en firmas nuevas y son lo único que
alimenta los correos (RAT: a los proveedores llega solo el primer nombre).
"""
import uuid
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.models.signature import Signature
from app.schemas.signature import SignatureCreate
from app.services import comms_service
from app.services.retention_service import anonymize_signature
from app.services.signature_service import create_signature

from test_confirmation_email import _fila, mundo, provider  # noqa: F401
from test_validacion_cedula_integracion import (  # noqa: F401
    CEDULA_VALIDA, IP_HMAC, _cleanup, _make_campaign, _make_org, db,
)
from app.services import confirmation_email_service as svc


def _datos(**over) -> dict:
    base = dict(email=f"{uuid.uuid4().hex[:8]}@test.local", cedula=CEDULA_VALIDA, location_mode="nacional",
                provincia="Pichincha", visibility="publica", consent=True)
    base.update(over)
    return base


# ── Schema (R14, R15, R18) ──────────────────────────────────────────────────────────────────────────────────

def test_el_nombre_se_compone_de_nombre_y_apellido():
    d = SignatureCreate(**_datos(first_name="  María   José ", last_name="Pérez  Mora"))
    assert (d.first_name, d.last_name, d.name) == ("María José", "Pérez Mora", "María José Pérez Mora")


def test_un_cliente_anterior_que_solo_envia_name_sigue_funcionando():
    d = SignatureCreate(**_datos(name="Ana Pérez"))
    assert d.name == "Ana Pérez" and d.first_name is None and d.last_name is None


@pytest.mark.parametrize("over", [
    {}, {"name": "   "}, {"first_name": "Ana"}, {"last_name": "Pérez"}, {"first_name": "Ana", "last_name": "  "},
    {"first_name": "A" * 121, "last_name": "Pérez"}, {"first_name": "Ana", "last_name": "P" * 121},
])
def test_rechaza_nombres_incompletos_o_demasiado_largos(over):
    with pytest.raises(ValidationError):
        SignatureCreate(**_datos(**over))


def test_acepta_el_maximo_en_cada_parte():
    d = SignatureCreate(**_datos(first_name="A" * 120, last_name="P" * 120))
    assert len(d.name) == 241  # 120 + espacio + 120; cabe en String(255)


# ── Guardado (R15) ──────────────────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_signature_guarda_los_tres_campos(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        sig = await create_signature(db, camp, SignatureCreate(**_datos(first_name="María José", last_name="Pérez Mora")), IP_HMAC)
        fila = (await db.execute(select(Signature).where(Signature.id == sig.id))).scalar_one()
        assert (fila.name, fila.first_name, fila.last_name) == ("María José Pérez Mora", "María José", "Pérez Mora")
        assert fila.greeting_name == "María José"
    finally:
        await _cleanup(db, org, user, camp)


@pytest.mark.asyncio
async def test_create_signature_con_solo_name_deja_nulos_los_nuevos(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        sig = await create_signature(db, camp, SignatureCreate(**_datos(name="Ana Pérez")), IP_HMAC)
        fila = (await db.execute(select(Signature).where(Signature.id == sig.id))).scalar_one()
        assert (fila.name, fila.first_name, fila.last_name) == ("Ana Pérez", None, None)
        assert fila.greeting_name == "Ana Pérez"  # las plantillas toman solo la primera palabra
    finally:
        await _cleanup(db, org, user, camp)


# ── Correos: solo el nombre (R16) ───────────────────────────────────────────────────────────────────────────

async def test_el_correo_de_confirmacion_recibe_solo_el_nombre(mundo, provider):  # noqa: F811
    sig_id = await mundo["crear"](name="Ana Pérez Mora", first_name="Ana", last_name="Pérez Mora")
    assert await svc.attempt_send(sig_id) == "sent"
    assert provider.calls[0]["signer_name"] == "Ana"
    assert "Pérez" not in repr(provider.calls[0]) and "Mora" not in repr(provider.calls[0])


async def test_firma_anterior_sin_first_name_usa_name(mundo, provider):  # noqa: F811
    sig_id = await mundo["crear"](name="Ana Pérez Mora")
    assert await svc.attempt_send(sig_id) == "sent"
    assert provider.calls[0]["signer_name"] == "Ana Pérez Mora"  # la plantilla usa solo "Ana" (ver test de contenido)


@pytest.mark.asyncio
async def test_las_comunicaciones_toman_el_nombre_y_no_el_apellido(db):
    org, user = await _make_org(db)
    camp = await _make_campaign(db, org, user)
    try:
        nueva = await create_signature(db, camp, SignatureCreate(**_datos(first_name="Lucía", last_name="Paredes")), IP_HMAC)
        vieja = await create_signature(db, camp, SignatureCreate(**_datos(
            name="Pedro Salas", location_mode="internacional", country="España", provincia=None, cedula="X1234567L")), IP_HMAC)
        recibidos = {sid: nombre for _email, nombre, sid in await comms_service.get_recipients_by_ids(db, [nueva.id, vieja.id])}
        assert recibidos[nueva.id] == "Lucía" and recibidos[vieja.id] == "Pedro Salas"
        assert comms_service.build_merge_context(
            comms_service.RecipientData(signature_id=nueva.id, email="x@test.local", name=recibidos[nueva.id])
        ).nombre == "Lucía"
    finally:
        await _cleanup(db, org, user, camp)


# ── Anonimización (R17) ─────────────────────────────────────────────────────────────────────────────────────

def test_la_anonimizacion_borra_nombre_y_apellido():
    sig = Signature(name="Ana Pérez", first_name="Ana", last_name="Pérez", email_encrypted="x", email_hash="h")
    anonymize_signature(sig, datetime.now(timezone.utc))
    assert sig.name is None and sig.first_name is None and sig.last_name is None
