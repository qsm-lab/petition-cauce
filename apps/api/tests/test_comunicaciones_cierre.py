"""Tests de comunicaciones-cierre-campana — services/email_service.py.

Los builders de HTML son funciones puras (sin DB): se testean directo.
Las funciones de audiencia (get_signer_emails_nacional_confirmed,
..._todos_confirmed) y el filtro de exclusión de nombre nulo en
get_signature_count/get_total_signature_count requieren sesión de DB —
no hay fixture de DB en este repo para tests unitarios (ver conftest.py,
solo expone un client HTTP); se verificaron manualmente contra la DB de
dev vía los endpoints (curl/httpx), ver notas de sesión 32.
"""
from datetime import datetime, timezone

from app.services.email_service import (
    _build_delivery_event_invitation_html,
    _build_campaign_closing_html,
    _fmt_event_datetime,
    _render_message_html,
)
from app.schemas.campaign import EventInvitationRequest, ClosingNotificationRequest
import pytest
from pydantic import ValidationError


def _dt():
    return datetime(2026, 8, 1, 15, 0, tzinfo=timezone.utc)


def test_invitation_html_sin_mapa_ni_imagen_no_incluye_esos_bloques():
    html = _build_delivery_event_invitation_html(
        campaign_title="Soberanía TLC",
        event_title="Entrega de la petición",
        event_datetime=_dt(),
        event_location="Cancillería, Quito",
    )
    assert "Ver ubicación" not in html
    assert "<img" not in html  # ni banner ni logo (org_logo_url tampoco vino)
    assert "Cancillería, Quito" in html
    assert "1 de agosto de 2026" in html


def test_invitation_html_con_mapa_incluye_boton():
    html = _build_delivery_event_invitation_html(
        campaign_title="Soberanía TLC",
        event_title="Entrega de la petición",
        event_datetime=_dt(),
        event_location="Cancillería, Quito",
        event_map_url="https://maps.google.com/?q=x",
    )
    assert "Ver ubicación" in html
    assert "https://maps.google.com/?q=x" in html


def test_invitation_html_con_mensaje_lo_incluye():
    html = _build_delivery_event_invitation_html(
        campaign_title="Soberanía TLC",
        event_title="Entrega",
        event_datetime=_dt(),
        event_location="Quito",
        message="Traigan banderas.",
    )
    assert "Traigan banderas." in html


def test_closing_html_omite_social_links_vacios():
    html = _build_campaign_closing_html(
        campaign_title="Soberanía TLC",
        final_count=1234,
        social_links={"website": None, "instagram": ""},
    )
    assert "Seguí la causa" not in html
    assert "1.234" in html  # separador de miles es punto, no coma


def test_closing_html_incluye_solo_links_con_valor():
    html = _build_campaign_closing_html(
        campaign_title="Soberanía TLC",
        final_count=5,
        social_links={
            "website": "https://ecuadornotlc.org",
            "instagram": None,
            "newsletter": "https://ecuadornotlc.org/newsletter",
        },
    )
    assert "https://ecuadornotlc.org" in html
    assert "https://ecuadornotlc.org/newsletter" in html
    assert html.count("aria-label=") == 2  # solo 2 de 8 posibles — un ícono por red con valor


def test_event_invitation_request_exige_lugar_no_vacio():
    with pytest.raises(ValidationError):
        EventInvitationRequest(event_datetime=_dt(), event_location="   ")


def test_event_invitation_request_test_emails_valida_formato():
    with pytest.raises(ValidationError):
        EventInvitationRequest(
            event_datetime=_dt(), event_location="Quito", test_emails=["no-es-un-email"]
        )


def test_event_invitation_request_acepta_test_emails_validos():
    req = EventInvitationRequest(
        event_datetime=_dt(), event_location="Quito", test_emails=["a@b.com", "c@d.com"]
    )
    assert len(req.test_emails) == 2


def test_closing_notification_request_test_emails_opcional():
    assert ClosingNotificationRequest().test_emails is None


def test_invitation_html_personaliza_con_primer_nombre():
    html = _build_delivery_event_invitation_html(
        campaign_title="Soberanía TLC",
        event_title="Entrega",
        event_datetime=_dt(),
        event_location="Quito",
        signer_name="María Fernanda Pérez",
    )
    assert "María, la campaña" in html
    assert "Fernanda" not in html  # solo primer nombre, mismo patrón que el resto de emails


def test_invitation_html_sin_nombre_no_deja_coma_colgada():
    html = _build_delivery_event_invitation_html(
        campaign_title="Soberanía TLC", event_title="Entrega",
        event_datetime=_dt(), event_location="Quito",
    )
    assert "La campaña <strong>Soberanía TLC</strong> te invita" in html


def test_invitation_html_subtitulo_opcional():
    html = _build_delivery_event_invitation_html(
        campaign_title="X", event_title="Entrega", event_datetime=_dt(), event_location="Quito",
        event_subtitle="Frente a la sede principal",
    )
    assert "Frente a la sede principal" in html


def test_invitation_html_incluye_los_3_links_de_calendario():
    html = _build_delivery_event_invitation_html(
        campaign_title="X", event_title="Entrega", event_datetime=_dt(), event_location="Quito",
    )
    assert "calendar.google.com" in html
    assert "outlook.live.com" in html
    assert "calendar.ics" in html


def test_invitation_html_omite_redes_sin_valor():
    html = _build_delivery_event_invitation_html(
        campaign_title="X", event_title="Entrega", event_datetime=_dt(), event_location="Quito",
        social_links={"instagram": None, "facebook": ""},
    )
    assert "Seguí la causa" not in html


def test_invitation_html_incluye_solo_redes_con_valor():
    html = _build_delivery_event_invitation_html(
        campaign_title="X", event_title="Entrega", event_datetime=_dt(), event_location="Quito",
        social_links={"website": "https://ecuadornotlc.org", "instagram": None},
    )
    assert "https://ecuadornotlc.org" in html
    assert "Sitio web" in html


def test_invitation_html_boton_ubicacion_no_es_pastilla_solida():
    html = _build_delivery_event_invitation_html(
        campaign_title="X", event_title="Entrega", event_datetime=_dt(), event_location="Quito",
        event_map_url="https://maps.google.com/?q=x",
    )
    assert "background:#3d6b35;color:#fff" not in html  # ya no es el botón sólido original


def test_event_invitation_request_acepta_subtitulo_y_subject():
    req = EventInvitationRequest(
        event_datetime=_dt(), event_location="Quito",
        event_subtitle="Frente a la sede", subject="Asunto personalizado",
    )
    assert req.event_subtitle == "Frente a la sede"
    assert req.subject == "Asunto personalizado"


def test_invitation_html_incluye_x_y_arma_mailto_para_email():
    html = _build_delivery_event_invitation_html(
        campaign_title="X", event_title="Entrega", event_datetime=_dt(), event_location="Quito",
        social_links={"x": "https://x.com/ecuadornotlc", "email": "contacto@ecuadornotlc.org"},
    )
    assert "https://x.com/ecuadornotlc" in html
    assert 'href="mailto:contacto@ecuadornotlc.org"' in html


def test_closing_html_incluye_x_y_arma_mailto_para_email():
    html = _build_campaign_closing_html(
        campaign_title="X", final_count=10,
        social_links={"x": "https://x.com/ecuadornotlc", "email": "contacto@ecuadornotlc.org"},
    )
    assert "https://x.com/ecuadornotlc" in html
    assert 'href="mailto:contacto@ecuadornotlc.org"' in html


def test_social_href_no_duplica_mailto_si_ya_viene_con_prefijo():
    from app.services.email_service import _social_href
    assert _social_href("email", "mailto:a@b.com") == "mailto:a@b.com"
    assert _social_href("email", "a@b.com") == "mailto:a@b.com"
    assert _social_href("x", "https://x.com/foo") == "https://x.com/foo"


def test_invitation_html_mensaje_va_antes_de_agendar_y_redes():
    html = _build_delivery_event_invitation_html(
        campaign_title="X", event_title="Entrega", event_datetime=_dt(), event_location="Quito",
        message="Traigan banderas.", social_links={"website": "https://x.org"},
    )
    assert html.index("Traigan banderas.") < html.index(">Agendar<")
    assert html.index("Traigan banderas.") < html.index("Seguí la causa")


def test_invitation_html_redes_son_iconos_png_hosteados():
    html = _build_delivery_event_invitation_html(
        campaign_title="X", event_title="Entrega", event_datetime=_dt(), event_location="Quito",
        social_links={"website": "https://x.org", "whatsapp": "https://wa.me/123"},
    )
    # No más SVG inline (Gmail lo elimina del cuerpo del email) — íconos como
    # <img> hosteados en el dominio de la web.
    assert "<svg" not in html
    assert html.count("/icons/social/") >= 2
    assert "icons/social/website.png" in html
    assert "icons/social/whatsapp.png" in html
    assert "aria-label=\"Sitio web\"" in html
    assert "aria-label=\"WhatsApp\"" in html


def test_closing_html_redes_son_iconos_png_hosteados():
    html = _build_campaign_closing_html(
        campaign_title="X", final_count=1, social_links={"instagram": "https://instagram.com/x"},
    )
    assert "aria-label=\"Instagram\"" in html
    assert "<svg" not in html
    assert "icons/social/instagram.png" in html


def test_fmt_event_datetime_convierte_utc_a_hora_local_ecuador():
    # 15:00 UTC == 10:00 en América/Guayaquil (UTC-5, sin horario de verano) —
    # el formulario captura la hora local, el navegador la manda en UTC.
    assert _fmt_event_datetime(_dt()) == "1 de agosto de 2026 · 10:00"


def test_fmt_event_datetime_naive_se_asume_utc_igual_que_los_links_de_calendario():
    naive = datetime(2026, 8, 1, 15, 0)
    assert _fmt_event_datetime(naive) == "1 de agosto de 2026 · 10:00"


def test_invitation_html_muestra_hora_local_no_utc():
    html = _build_delivery_event_invitation_html(
        campaign_title="X", event_title="Entrega",
        event_datetime=datetime(2026, 8, 1, 15, 0, tzinfo=timezone.utc),
        event_location="Quito",
    )
    assert "10:00" in html
    assert "15:00" not in html


def test_render_message_html_negrita_y_cursiva():
    html = _render_message_html("Traigan **banderas** y *pancartas*.")
    assert "<strong>banderas</strong>" in html
    assert "<em>pancartas</em>" in html


def test_render_message_html_linea_en_blanco_separa_parrafos():
    html = _render_message_html("Primer párrafo.\n\nSegundo párrafo.")
    assert html.count("<p") == 2
    assert "Primer párrafo." in html
    assert "Segundo párrafo." in html


def test_render_message_html_salto_de_linea_simple_es_br():
    html = _render_message_html("Línea uno.\nLínea dos.")
    assert "Línea uno.<br>Línea dos." in html


def test_render_message_html_escapa_html_del_admin():
    html = _render_message_html("<script>alert(1)</script>")
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_render_message_html_vacio_no_genera_bloque():
    assert _render_message_html(None) == ""
    assert _render_message_html("   ") == ""
