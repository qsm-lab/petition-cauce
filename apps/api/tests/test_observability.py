"""hardening-campana R6a: logs de acceso estructurados y sin PII."""
import json
import logging

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def lineas(caplog):
    caplog.set_level(logging.INFO, logger="app.access")
    logger = logging.getLogger("app.access")
    logger.propagate = True  # para que caplog lo capture en el test
    yield lambda: [json.loads(r.getMessage()) for r in caplog.records if r.name == "app.access"]
    logger.propagate = False


async def test_registra_ruta_plantilla_sin_query_ni_ip(lineas):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/v1/public-campaign/by-slug/no-existe?email=ana@correo.ec&cedula=1710034065",
                        headers={"X-Real-IP": "190.12.34.56"})
    assert r.headers.get("x-request-id")
    entradas = lineas()
    assert entradas and entradas[-1]["event"] == "http"
    texto = json.dumps(entradas)
    for dato in ("ana@correo.ec", "1710034065", "190.12.34.56", "no-existe"):
        assert dato not in texto
    assert entradas[-1]["route"] == "/v1/public-campaign/by-slug/{slug}"
    assert entradas[-1]["status"] in (404, 200)


async def test_excepcion_no_controlada_registra_solo_el_tipo(lineas):
    async def boom():
        raise ValueError("falló para ana@correo.ec cédula 1710034065")

    app.add_api_route("/_test_boom", boom)
    try:
        async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False),
                               base_url="http://test") as c:
            r = await c.get("/_test_boom")
    finally:
        app.router.routes = [x for x in app.router.routes if getattr(x, "path", "") != "/_test_boom"]
    assert r.status_code == 500
    ultima = lineas()[-1]
    assert ultima["status"] == 500 and ultima["error"] == "ValueError"
    assert "ana@correo.ec" not in json.dumps(ultima) and "1710034065" not in json.dumps(ultima)


async def test_health_ok_no_genera_ruido(lineas):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/health")
    if r.status_code == 200:
        assert all(e["route"] != "/health" for e in lineas())
