"""Pico de altas: sin conexión libre en el pool, el envío inmediato no revienta la tarea en segundo plano."""
import uuid

from sqlalchemy.exc import TimeoutError as PoolTimeoutError

from app.services import confirmation_email_service as svc


async def test_pool_agotado_deja_la_firma_para_el_loop(monkeypatch, caplog):
    async def sin_conexion(*args, **kwargs):
        raise PoolTimeoutError("QueuePool limit reached")

    monkeypatch.setattr(svc, "set_rls_context", sin_conexion)
    sig_id = uuid.uuid4()
    with caplog.at_level("WARNING"):
        assert await svc.attempt_send(sig_id, max_wait=0.5) == "skipped"
    assert "confirm_email_pool_saturado" in caplog.text
    assert str(sig_id) in caplog.text
