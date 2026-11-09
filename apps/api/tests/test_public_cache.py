"""cache-lecturas-publicas: caché Redis de las lecturas públicas y los riesgos RK2, RK3, RK5, RK6, RK7, RK10, RK11 y RK12.

Usa el Redis de desarrollo (se limpian solo las claves `pubcache:*`). Reutiliza la fábrica `mundo` de test_confirmation_email.
"""
import asyncio
import json
import time
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import TimeoutError as PoolTimeoutError

from app.redis_client import close_redis, get_redis, init_redis
from app.routers import public_campaign as pc
from app.services import public_cache as cache
from app.services.auth_service import create_access_token
from test_confirmation_email import mundo, provider  # noqa: F401

BASE = "/v1/public-campaign"


async def _flush():
    r = get_redis()
    keys = [k async for k in r.scan_iter("pubcache:*")]
    if keys:
        await r.delete(*keys)


@pytest.fixture(autouse=True)
async def redis_limpio():
    await init_redis()
    cache._down_until = 0.0  # el interruptor de Redis caído no debe filtrarse entre tests
    await _flush()
    yield
    cache._down_until = 0.0
    await _flush()
    await close_redis()


def _contar(monkeypatch, nombre="_campaign_payload"):
    llamadas = {"n": 0}
    original = getattr(pc, nombre)

    async def contado(*a, **k):
        llamadas["n"] += 1
        return await original(*a, **k)

    monkeypatch.setattr(pc, nombre, contado)
    return llamadas


# ── R1, R4: aciertos, fallos y cabeceras ────────────────────────────────────────────────────────────────────

async def test_segunda_lectura_sale_de_la_copia_y_lleva_cache_control(client, mundo):
    slug = mundo["camp"].slug
    r1 = await client.get(f"{BASE}/by-slug/{slug}")
    r2 = await client.get(f"{BASE}/by-slug/{slug}")
    assert r1.status_code == r2.status_code == 200
    assert (r1.headers["x-cache"], r2.headers["x-cache"]) == ("MISS", "HIT")
    assert r2.headers["cache-control"] == "public, s-maxage=10, stale-while-revalidate=30"
    assert r1.json() == r2.json() and r1.json()["slug"] == slug


async def test_by_slug_y_por_id_comparten_la_copia(client, mundo, monkeypatch):
    llamadas = _contar(monkeypatch)
    cid = str(mundo["camp"].id)
    await client.get(f"{BASE}/by-slug/{mundo['camp'].slug}")
    r = await client.get(f"{BASE}/{cid}")
    assert r.headers["x-cache"] == "HIT" and llamadas["n"] == 1


async def test_la_copia_vence_y_se_reconstruye(client, mundo, monkeypatch):
    llamadas = _contar(monkeypatch)
    monkeypatch.setattr(cache.settings, "public_cache_ttl_seconds", 1)
    slug = mundo["camp"].slug
    await client.get(f"{BASE}/by-slug/{slug}")
    await asyncio.sleep(1.2)
    r = await client.get(f"{BASE}/by-slug/{slug}")
    assert r.status_code == 200 and llamadas["n"] == 2


# ── R2: sin estampida ───────────────────────────────────────────────────────────────────────────────────────

async def test_con_la_copia_vacia_solo_un_proceso_reconstruye(client, mundo, monkeypatch):
    llamadas = _contar(monkeypatch)
    slug = mundo["camp"].slug
    resp = await asyncio.gather(*[client.get(f"{BASE}/by-slug/{slug}") for _ in range(40)])
    assert {r.status_code for r in resp} == {200}
    assert llamadas["n"] == 1  # RK9: arranque en frío


# ── RK10: slugs e ids inventados no tocan la base ───────────────────────────────────────────────────────────

async def test_slugs_e_ids_inventados_responden_404_sin_consultar_campanas(client, mundo, monkeypatch):
    payload = _contar(monkeypatch)
    indice = _contar(monkeypatch, "_visible_index")
    await client.get(f"{BASE}/by-slug/{mundo['camp'].slug}")  # calienta el índice
    resp = await asyncio.gather(
        *[client.get(f"{BASE}/by-slug/inventado-{uuid.uuid4().hex}") for _ in range(30)],
        *[client.get(f"{BASE}/{uuid.uuid4()}") for _ in range(30)],
        *[client.get(f"{BASE}/{uuid.uuid4()}/signatures/recent") for _ in range(10)],
    )
    assert {r.status_code for r in resp} == {404}
    assert all(r.headers["cache-control"] == "no-store" for r in resp)  # RK5
    assert payload["n"] == 1 and indice["n"] == 1


async def test_la_clave_de_indice_no_se_llena_con_slugs_inventados(client, mundo):
    await client.get(f"{BASE}/by-slug/{mundo['camp'].slug}")
    await asyncio.gather(*[client.get(f"{BASE}/by-slug/x-{uuid.uuid4().hex}") for _ in range(50)])
    claves = [k async for k in get_redis().scan_iter("pubcache:*")]
    assert len(claves) <= 3  # índice + campaña (+ candado transitorio); ninguna por slug inventado


# ── RK12: todas las claves expiran ──────────────────────────────────────────────────────────────────────────

async def test_todas_las_claves_tienen_ttl(client, mundo):
    cid = str(mundo["camp"].id)
    await client.get(f"{BASE}/by-slug/{mundo['camp'].slug}")
    await client.get(f"{BASE}/{cid}/signatures/recent")
    r = get_redis()
    claves = [k async for k in r.scan_iter("pubcache:*")]
    assert claves
    for k in claves:
        ttl = await r.ttl(k)
        assert 0 < ttl <= cache.STALE_TTL, k


# ── RK3, R3: la copia no expone nombres que hoy no se muestran ──────────────────────────────────────────────

async def test_firmas_anonimas_y_secretas_no_aparecen_en_respuesta_ni_en_copia(client, mundo):
    ahora = datetime.now(timezone.utc)
    marcas = {"publica": "NombrePublicoVisible", "anonima": "NombreAnonimoOculto", "secreta": "NombreSecretoOculto"}
    for vis, nombre in marcas.items():
        await mundo["crear"](visibility=vis, status="confirmed", confirmed_at=ahora, name=nombre,
                             confirmation_email_status="sent")
    cid = str(mundo["camp"].id)
    for _ in range(2):  # la segunda sale de la copia
        r = await client.get(f"{BASE}/{cid}/signatures/recent")
        assert r.status_code == 200
        texto = r.text
        assert "NombrePublicoVisible" in texto
        assert "NombreAnonimoOculto" not in texto and "NombreSecretoOculto" not in texto
    crudo = await get_redis().get(f"{cache.PREFIX}recent:{cid}:10")
    assert "NombreAnonimoOculto" not in crudo and "NombreSecretoOculto" not in crudo


async def test_la_ficha_de_campana_no_incluye_datos_de_firmantes(client, mundo):
    await mundo["crear"](visibility="secreta", status="confirmed", confirmed_at=datetime.now(timezone.utc),
                         name="NombreSecretoOculto", confirmation_email_status="sent")
    r = await client.get(f"{BASE}/by-slug/{mundo['camp'].slug}")
    crudo = await get_redis().get(f"{cache.PREFIX}campaign:{mundo['camp'].id}")
    assert "NombreSecretoOculto" not in r.text and "NombreSecretoOculto" not in crudo


# ── R7, RK2, RK8: invalidación y campaña cerrada ────────────────────────────────────────────────────────────

async def test_cerrar_la_campana_refresca_la_copia_y_rechaza_firmas(client, mundo):
    slug, cid = mundo["camp"].slug, str(mundo["camp"].id)
    primera = await client.get(f"{BASE}/by-slug/{slug}")
    assert primera.json()["status"] == "active"

    cookies = {"access_token": create_access_token({"sub": str(mundo["user"].id)})}
    cerrar = await client.patch(f"/v1/campaigns/{cid}/status", json={"status": "closed"}, cookies=cookies)
    assert cerrar.status_code == 200, cerrar.text

    despues = await client.get(f"{BASE}/by-slug/{slug}")
    assert despues.headers["x-cache"] == "MISS" and despues.json()["status"] == "closed"

    firma = await client.post(f"{BASE}/{cid}/signatures", json={
        "name": "Ana Pérez", "email": "ana@firmante.test", "consent": True, "visibility": "anonima",
    })
    assert firma.status_code == 409  # el servidor nunca depende de la copia para aceptar firmas


async def test_invalidar_borra_campana_e_indice(client, mundo):
    cid = str(mundo["camp"].id)
    await client.get(f"{BASE}/by-slug/{mundo['camp'].slug}")
    await cache.invalidate_campaign(cid)
    claves = [k async for k in get_redis().scan_iter("pubcache:v1:*")]
    assert claves == []


# ── R5, RK5: pool agotado → 503 con Retry-After ─────────────────────────────────────────────────────────────

async def test_pool_agotado_responde_503_con_retry_after(client, mundo, monkeypatch):
    async def agotado(*a, **k):
        raise PoolTimeoutError("QueuePool limit of size 10 overflow 10 reached")

    monkeypatch.setattr(pc, "_campaign_payload", agotado)
    t0 = time.monotonic()
    r = await client.get(f"{BASE}/by-slug/{mundo['camp'].slug}")
    assert r.status_code == 503
    assert r.headers["retry-after"] == "5" and r.headers["cache-control"] == "no-store"
    assert time.monotonic() - t0 < 2


# ── RK6: Redis caído ────────────────────────────────────────────────────────────────────────────────────────

async def test_con_redis_caido_la_lectura_va_a_la_base(client, mundo, monkeypatch):
    def sin_redis():
        raise ConnectionError("Redis caído")

    monkeypatch.setattr(cache, "get_redis", sin_redis)
    r = await client.get(f"{BASE}/by-slug/{mundo['camp'].slug}")
    assert r.status_code == 200 and r.headers["x-cache"] == "BYPASS"
    assert (await client.get(f"{BASE}/{uuid.uuid4()}")).status_code == 404


async def test_sin_redis_la_concurrencia_a_la_base_tiene_tope_y_el_exceso_recibe_503_rapido(client, mundo, monkeypatch):
    """RK6: con Redis caído, 300 lectores no pueden agotar el pool (10 s de espera); el exceso se rechaza en < 1 s."""
    monkeypatch.setattr(cache, "get_redis", lambda: (_ for _ in ()).throw(ConnectionError("caído")))
    monkeypatch.setattr(cache, "_bypass_slots", asyncio.Semaphore(2))
    monkeypatch.setattr(cache, "BYPASS_WAIT", 0.2)
    activos = {"max": 0, "n": 0}
    original = pc._visible_index

    async def lento(db):
        activos["n"] += 1
        activos["max"] = max(activos["max"], activos["n"])
        try:
            await asyncio.sleep(0.6)
            return await original(db)
        finally:
            activos["n"] -= 1

    monkeypatch.setattr(pc, "_visible_index", lento)
    t0 = time.monotonic()
    resp = await asyncio.gather(*[client.get(f"{BASE}/by-slug/{mundo['camp'].slug}") for _ in range(12)])
    codigos = [r.status_code for r in resp]
    assert activos["max"] <= 2
    assert 503 in codigos and 200 in codigos and set(codigos) <= {200, 503}
    assert all(r.headers["retry-after"] == "1" for r in resp if r.status_code == 503)
    assert time.monotonic() - t0 < 3


async def test_tras_un_fallo_de_redis_no_se_reintenta_durante_la_pausa(client, mundo, monkeypatch):
    """RK6: cada intento contra un Redis caído tarda (DNS/timeout); el interruptor evita pagarlo en cada petición."""
    intentos = {"n": 0}

    def sin_redis():
        intentos["n"] += 1
        raise ConnectionError("caído")

    monkeypatch.setattr(cache, "get_redis", sin_redis)
    monkeypatch.setattr(cache, "_down_until", 0.0)
    for _ in range(5):
        assert (await client.get(f"{BASE}/by-slug/{mundo['camp'].slug}")).status_code == 200
    assert intentos["n"] == 1  # solo el primero intentó; los demás fueron directo a la base
    monkeypatch.setattr(cache, "_down_until", 0.0)  # pasada la pausa vuelve a intentar
    await client.get(f"{BASE}/by-slug/{mundo['camp'].slug}")
    assert intentos["n"] == 2


async def test_si_la_reconstruccion_falla_se_sirve_la_copia_anterior():
    async def bueno():
        return {"n": 1}

    async def malo():
        raise RuntimeError("base caída")

    await cache.get_or_build("prueba:stale", bueno, ttl=-1)  # nace ya vencida
    valor, estado = await cache.get_or_build("prueba:stale", malo)
    assert (valor, estado) == ({"n": 1}, "STALE")


async def test_una_httpexception_del_constructor_no_se_cachea_ni_se_reemplaza_por_la_copia():
    from fastapi import HTTPException

    async def bueno():
        return {"n": 1}

    async def no_existe():
        raise HTTPException(status_code=404)

    await cache.get_or_build("prueba:404", bueno, ttl=-1)
    with pytest.raises(HTTPException):
        await cache.get_or_build("prueba:404", no_existe)


# ── RK7: reconstructor lento o con error ────────────────────────────────────────────────────────────────────

async def test_constructor_lento_no_cuelga_a_los_demas_ni_duplica_sin_control(monkeypatch):
    monkeypatch.setattr(cache, "LOCK_TTL", 1)
    monkeypatch.setattr(cache, "WAIT_SECONDS", 3.0)
    llamadas = {"n": 0}

    async def lento():
        llamadas["n"] += 1
        await asyncio.sleep(1.5)
        return {"ok": True}

    t0 = time.monotonic()
    resultados = await asyncio.gather(*[cache.get_or_build("prueba:lento", lento) for _ in range(20)])
    assert time.monotonic() - t0 < 3.5
    assert all(v == {"ok": True} for v, _ in resultados)
    assert llamadas["n"] <= 2


async def test_si_el_constructor_falla_el_candado_se_libera():
    async def falla():
        raise RuntimeError("error")

    async def bueno():
        return {"ok": True}

    with pytest.raises(RuntimeError):
        await cache.get_or_build("prueba:error", falla)
    t0 = time.monotonic()
    valor, _ = await cache.get_or_build("prueba:error", bueno)
    assert valor == {"ok": True} and time.monotonic() - t0 < 0.5


async def test_sin_copia_y_con_el_candado_ocupado_responde_503_corto(client, mundo, monkeypatch):
    monkeypatch.setattr(cache, "WAIT_SECONDS", 0.3)
    cid = str(mundo["camp"].id)
    await client.get(f"{BASE}/by-slug/{mundo['camp'].slug}")  # indice calentado
    await get_redis().delete(f"{cache.PREFIX}campaign:{cid}")
    await get_redis().set(f"{cache.PREFIX[:-3]}lock:campaign:{cid}", "otro", ex=5)  # otro proceso reconstruyendo
    r = await client.get(f"{BASE}/{cid}")
    assert r.status_code == 503 and r.headers["retry-after"] == "1"


# ── RK11: CORS y copia ──────────────────────────────────────────────────────────────────────────────────────

async def test_la_respuesta_varia_por_origen(client, mundo):
    slug = mundo["camp"].slug
    permitido = await client.get(f"{BASE}/by-slug/{slug}", headers={"Origin": "http://localhost:3002"})
    ajeno = await client.get(f"{BASE}/by-slug/{slug}", headers={"Origin": "https://otro-sitio.example"})
    assert "origin" in permitido.headers.get("vary", "").lower()
    assert "access-control-allow-origin" not in ajeno.headers
    assert ajeno.status_code == 200
