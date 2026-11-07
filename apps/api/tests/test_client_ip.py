"""hardening-campana R2: una sola fuente de IP del cliente."""
from types import SimpleNamespace

from app.client_ip import get_client_ip, is_cloudflare_ip

CF = "172.67.10.20"      # borde de Cloudflare
REAL = "190.12.34.56"    # cliente real
OTRO = "203.0.113.9"


def _req(headers: dict, host: str | None = "127.0.0.1"):
    return SimpleNamespace(
        headers={k: v for k, v in headers.items()},
        client=SimpleNamespace(host=host) if host else None,
    )


def test_nginx_ya_restauro_la_ip_se_usa_x_real_ip():
    assert get_client_ip(_req({"X-Real-IP": REAL})) == REAL


def test_cabecera_cf_se_ignora_si_el_peer_no_es_cloudflare():
    # Alguien pega directo al origen e inventa CF-Connecting-IP.
    assert get_client_ip(_req({"X-Real-IP": OTRO, "CF-Connecting-IP": "1.2.3.4"})) == OTRO


def test_peer_cloudflare_usa_cf_connecting_ip():
    assert get_client_ip(_req({"X-Real-IP": CF, "CF-Connecting-IP": REAL})) == REAL


def test_peer_cloudflare_con_cabecera_invalida_cae_al_peer():
    assert get_client_ip(_req({"X-Real-IP": CF, "CF-Connecting-IP": "no-es-ip"})) == CF


def test_xff_no_se_usa_nunca():
    assert get_client_ip(_req({"X-Real-IP": OTRO, "X-Forwarded-For": "9.9.9.9"})) == OTRO


def test_sin_cabeceras_usa_el_socket():
    assert get_client_ip(_req({}, host="10.0.0.7")) == "10.0.0.7"


def test_sin_nada_devuelve_unknown():
    assert get_client_ip(_req({}, host=None)) == "unknown"


def test_is_cloudflare_ip():
    assert is_cloudflare_ip("104.16.1.1")
    assert is_cloudflare_ip("2606:4700::1")
    assert not is_cloudflare_ip(REAL)
    assert not is_cloudflare_ip("basura")
    assert not is_cloudflare_ip(None)
