"""verificacion-confirmacion-privacidad (D1=A): el GET del enlace no confirma; solo el POST de la página lo hace.

Reutiliza la fábrica `mundo` de test_confirmation_email (firmas pendientes en una organización propia).
"""
from datetime import datetime, timedelta, timezone

from test_confirmation_email import _fila, mundo, provider  # noqa: F401

PATH = "/v1/public-campaign/confirm/"


async def test_get_redirige_a_la_pagina_sin_confirmar(client, mundo):
    sig_id = await mundo["crear"]()
    token = (await _fila(sig_id)).confirmation_token

    r = await client.get(f"{PATH}{token}", follow_redirects=False)

    assert r.status_code == 302
    assert r.headers["location"].endswith(f"/confirmar/{token}")
    fila = await _fila(sig_id)
    assert fila.status == "pending_confirmation" and fila.confirmed_at is None


async def test_get_repetido_o_de_escaner_nunca_cambia_el_estado(client, mundo):
    sig_id = await mundo["crear"]()
    token = (await _fila(sig_id)).confirmation_token
    for _ in range(3):
        await client.get(f"{PATH}{token}", follow_redirects=False)
        await client.head(f"{PATH}{token}", follow_redirects=False)
    assert (await _fila(sig_id)).status == "pending_confirmation"


async def test_get_con_token_desconocido_redirige_igual(client):
    r = await client.get(f"{PATH}no-existe", follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"].endswith("/confirmar/no-existe")


async def test_post_confirma_la_firma(client, mundo):
    sig_id = await mundo["crear"]()
    token = (await _fila(sig_id)).confirmation_token

    r = await client.post(f"{PATH}{token}")

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "confirmed" and body["slug"] == mundo["camp"].slug
    fila = await _fila(sig_id)
    assert fila.status == "confirmed" and fila.confirmed_at is not None


async def test_post_es_idempotente(client, mundo):
    sig_id = await mundo["crear"]()
    token = (await _fila(sig_id)).confirmation_token

    primero = await client.post(f"{PATH}{token}")
    confirmada_en = (await _fila(sig_id)).confirmed_at
    segundo = await client.post(f"{PATH}{token}")

    assert primero.json()["status"] == segundo.json()["status"] == "confirmed"
    assert (await _fila(sig_id)).confirmed_at == confirmada_en


async def test_post_con_token_vencido_no_confirma(client, mundo):
    sig_id = await mundo["crear"](confirmation_token_expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    token = (await _fila(sig_id)).confirmation_token

    r = await client.post(f"{PATH}{token}")

    assert r.status_code == 200 and r.json()["status"] == "expired"
    assert (await _fila(sig_id)).status == "pending_confirmation"


async def test_post_con_token_desconocido_no_revela_nada(client):
    r = await client.post(f"{PATH}no-existe")
    assert r.status_code == 200 and r.json() == {"status": "invalid"}


async def test_post_devuelve_el_nombre_solo_si_la_firma_es_publica(client, mundo):
    publica = (await _fila(await mundo["crear"](visibility="publica"))).confirmation_token
    assert (await client.post(f"{PATH}{publica}")).json()["name"] == "Ana Pérez Mora"

    for visibilidad in ("anonima", "secreta"):
        token = (await _fila(await mundo["crear"](visibility=visibilidad))).confirmation_token
        body = (await client.post(f"{PATH}{token}")).json()
        assert body["status"] == "confirmed" and "name" not in body, visibilidad
        assert "Ana" not in str(body), visibilidad  # ni siquiera en otro campo
