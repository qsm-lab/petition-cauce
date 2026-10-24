import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture(autouse=True)
def _no_real_email(monkeypatch):
    """Ningún test envía correo real: el contenedor dev tiene RESEND_API_KEY real
    y cada pasada de la suite mandaba ~36 correos (agotó la cuota diaria de Resend).
    Los envíos quedan en la lista `sent` (accesible vía `_no_real_email.sent`)."""
    from app.services import email_transport as et

    sent: list = []

    async def _fake_send(self, msg):
        sent.append(msg)
        return et.SendResult(ok=True)

    monkeypatch.setattr(et.ResendTransport, "send", _fake_send)
    monkeypatch.setattr(et.BrevoTransport, "send", _fake_send)  # brevo-pool R13
    return sent
