"""Logs de acceso estructurados y sin PII (hardening-campana R6a / T3.3).

Una línea JSON por petición en el logger `app.access`:
  {"event":"http","rid":"…","method":"POST","route":"/v1/public-campaign/{campaign_id}/signatures",
   "status":201,"ms":42}

Nunca se registran query string, cabeceras, cookies, cuerpo, IP ni los parámetros reales de la ruta
(solo la plantilla). Ante una excepción no controlada se registra solo el nombre de la clase, no su
mensaje (podría contener datos personales). `business_signals.sh` cuenta los `"status":5xx`.
"""
import json
import logging
import sys
import time
import uuid

_access = logging.getLogger("app.access")


def setup_access_logging() -> None:
    if _access.handlers:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    _access.addHandler(handler)
    _access.setLevel(logging.INFO)
    _access.propagate = False


def _route_template(scope) -> str:
    """Ruta con los parámetros sustituidos por su nombre (`/x/{id}`), sin valores reales.
    Se arma desde el path real y `path_params` para no depender de cómo se anida el router."""
    if scope.get("route") is None:
        return "unmatched"
    segments = scope.get("path", "").split("/")
    for name, value in (scope.get("path_params") or {}).items():
        for i, seg in enumerate(segments):
            if seg == str(value):
                segments[i] = "{" + name + "}"
                break
    return "/".join(segments) or "/"


class AccessLogMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        rid = uuid.uuid4().hex[:12]
        start = time.perf_counter()
        status = {"code": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
                message.setdefault("headers", []).append((b"x-request-id", rid.encode()))
            await send(message)

        error_type = None
        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:  # noqa: BLE001 — se registra solo el tipo y se re-lanza
            error_type = type(exc).__name__
            raise
        finally:
            code = status["code"]
            route = _route_template(scope)
            # /health se consulta cada pocos segundos: solo se registra si falla.
            if not (route == "/health" and code == 200):
                entry = {
                    "event": "http", "rid": rid, "method": scope["method"], "route": route,
                    "status": code, "ms": round((time.perf_counter() - start) * 1000),
                }
                if error_type:
                    entry["error"] = error_type
                _access.log(logging.ERROR if code >= 500 else logging.INFO,
                            json.dumps(entry, separators=(",", ":")))
