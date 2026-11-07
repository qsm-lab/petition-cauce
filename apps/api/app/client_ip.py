"""IP del cliente (hardening-campana R2).

Una sola fuente para rate limit, `ip_hmac`, login y auditoría. La API escucha solo en
127.0.0.1 detrás de nginx, que fija `X-Real-IP` con `$remote_addr`:

- Si nginx restaura la IP real desde `CF-Connecting-IP` (`real_ip_header`), `X-Real-IP` ya
  es la del cliente y se usa tal cual.
- Si no la restaura, `X-Real-IP` es una IP de borde de Cloudflare: solo en ese caso se
  confía en `CF-Connecting-IP` (Cloudflare lo sobrescribe, un cliente no puede falsificarlo).
- Una conexión que no venga de Cloudflare nunca puede elegir su IP con cabeceras propias.

Rangos de https://www.cloudflare.com/ips-v4 y /ips-v6; revisar de vez en cuando.
"""
import ipaddress

from fastapi import Request

_CLOUDFLARE_RANGES = [
    ipaddress.ip_network(n)
    for n in (
        "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
        "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
        "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
        "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
        "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
        "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
    )
]


def _parse(value: str | None):
    try:
        return ipaddress.ip_address((value or "").strip())
    except ValueError:
        return None


def is_cloudflare_ip(value: str | None) -> bool:
    addr = _parse(value)
    return addr is not None and any(addr in net for net in _CLOUDFLARE_RANGES)


def get_client_ip(request: Request) -> str:
    peer = (request.headers.get("X-Real-IP") or "").strip() or (
        request.client.host if request.client else ""
    )
    if is_cloudflare_ip(peer):
        cf = request.headers.get("CF-Connecting-IP")
        if _parse(cf) is not None:
            return cf.strip()
    return peer or "unknown"
