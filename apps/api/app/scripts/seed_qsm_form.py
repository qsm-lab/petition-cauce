"""Carga la Encuesta de Comunidad QSM 2025 en la base de datos.

Idempotente: si la campaña ya existe con el slug dado, no hace nada.

Uso:
    docker exec petition-api-dev python -m app.scripts.seed_qsm_form   # dev
    docker exec petition-api python -m app.scripts.seed_qsm_form        # producción
"""
import asyncio
import sys

sys.path.insert(0, "/app")

FORM_TITLE = "Encuesta de Comunidad QSM 2025: Tu voz, nuestra dirección"
CAMPAIGN_SLUG = "encuesta-comunidad-qsm-2025"
ORG_SLUG = "qsm"

PRIVACY_NOTICE = (
    "Los datos que proporciones en esta encuesta son confidenciales y serán utilizados "
    "exclusivamente para fines de investigación interna de Quito Sin Minería (QSM). "
    "No compartiremos tu información con terceros. Los resultados se publicarán de forma "
    "agregada y anónima. Puedes dejar de responder en cualquier momento."
)

QUESTIONS = [
    # ── Sección 0: Perfil sociodemográfico ──────────────────────────────────
    {
        "code": "P0_1", "order_index": 1, "type": "single_choice", "is_required": True,
        "label": "¿Cuál es tu rango de edad?",
        "description": "Sección 0: Perfil sociodemográfico",
        "options": [
            ("15-24 años", "15_24"), ("25-34 años", "25_34"), ("35-44 años", "35_44"),
            ("45-54 años", "45_54"), ("55 años o más", "55_mas"),
        ],
    },
    {
        "code": "P0_2", "order_index": 2, "type": "single_choice", "is_required": True,
        "label": "¿Cuál es tu género?",
        "options": [
            ("Mujer", "mujer"), ("Hombre", "hombre"),
            ("No binario / Otro", "no_binario"), ("Prefiero no decir", "no_decir"),
        ],
    },
    {
        "code": "P0_3", "order_index": 3, "type": "single_choice", "is_required": True,
        "label": "¿En qué zona de Quito resides?",
        "options": [
            ("Norte", "norte"), ("Centro-Norte", "centro_norte"),
            ("Centro Histórico", "centro"), ("Centro-Sur", "centro_sur"),
            ("Sur", "sur"), ("Valles (Cumbayá, Tumbaco, Los Chillos, etc.)", "valles"),
            ("Fuera de Quito", "fuera_quito"),
        ],
    },
    {
        "code": "P0_4", "order_index": 4, "type": "single_choice", "is_required": True,
        "label": "¿Cuál es tu nivel educativo?",
        "options": [
            ("Primaria", "primaria"), ("Secundaria", "secundaria"),
            ("Técnico / Tecnológico", "tecnico"), ("Universidad en curso", "universidad_curso"),
            ("Universitario completo", "universidad"), ("Posgrado", "posgrado"),
        ],
    },
    {
        "code": "P0_5", "order_index": 5, "type": "single_choice", "is_required": True,
        "label": "¿Cuál es tu ocupación principal?",
        "options": [
            ("Estudiante", "estudiante"), ("Empleado/a", "empleado"),
            ("Independiente / Freelance", "independiente"), ("Empresario/a", "empresario"),
            ("Desempleado/a", "desempleado"), ("Otro", "otro"),
        ],
    },
    # ── Sección 1: Hábitos digitales y relación con QSM ─────────────────────
    {
        "code": "P1", "order_index": 6, "type": "single_choice", "is_required": True,
        "label": "¿Por qué medio llegaste a esta encuesta?",
        "description": "Sección 1: Hábitos digitales y relación con QSM",
        "options": [
            ("Instagram", "instagram"), ("Facebook", "facebook"), ("TikTok", "tiktok"),
            ("WhatsApp / Grupos", "whatsapp"), ("Email / Newsletter", "email"), ("Otro", "otro"),
        ],
    },
    {
        "code": "P2", "order_index": 7, "type": "likert_scale", "is_required": True,
        "label": "¿Con qué frecuencia consumes contenido sobre temas ambientales, minería o derechos humanos?",
        "validation": {"min": 1, "max": 5, "labels": {"1": "Casi nunca", "5": "Diariamente"}},
    },
    {
        "code": "P3", "order_index": 8, "type": "multiple_choice", "is_required": True,
        "label": "¿Cuáles son las plataformas donde más consumes este tipo de contenido?",
        "options": [
            ("Instagram", "instagram"), ("Facebook", "facebook"), ("TikTok", "tiktok"),
            ("YouTube", "youtube"), ("Twitter / X", "twitter"), ("WhatsApp / Telegram", "whatsapp"),
            ("Sitios web / blogs", "web"),
        ],
    },
    {
        "code": "P4", "order_index": 9, "type": "multiple_choice", "is_required": True,
        "label": "¿Qué tipo de contenido sobre ambiente y minería te atrae más?",
        "options": [
            ("Videos cortos", "videos_cortos"), ("Infografías", "infografias"),
            ("Artículos de fondo", "articulos"), ("Transmisiones en vivo", "live"),
            ("Podcasts", "podcasts"), ("Fotografías", "fotos"),
            ("Noticias de último minuto", "noticias"), ("Guías de acción ciudadana", "guias"),
        ],
    },
    {
        "code": "P5", "order_index": 10, "type": "single_choice", "is_required": True,
        "label": "¿Desde hace cuánto tiempo sigues o conoces a QSM?",
        "options": [
            ("Menos de 6 meses", "menos_6m"), ("6 meses a 1 año", "6m_1a"),
            ("1 a 2 años", "1_2a"), ("Más de 2 años", "mas_2a"),
            ("No conozco a QSM", "no_conoce"),
        ],
    },
    {
        "code": "P6", "order_index": 11, "type": "single_choice", "is_required": True,
        "label": "¿Cómo te enteraste de Quito Sin Minería?",
        "options": [
            ("Redes sociales", "redes"), ("Un amigo o familiar", "amigo"),
            ("Medios de comunicación", "medios"), ("Eventos o marchas", "eventos"),
            ("Búsqueda en internet", "internet"), ("Otro", "otro"),
        ],
    },
    # ── Sección 2: Estado de ánimo ───────────────────────────────────────────
    {
        "code": "P7", "order_index": 12, "type": "matrix", "is_required": True,
        "label": "Cuando ves contenido de QSM, ¿con qué frecuencia sientes cada emoción?",
        "description": "Sección 2: Estado de ánimo  |  1 = Nunca · 5 = Siempre",
        "validation": {
            "items": [
                "Esperanza", "Preocupación", "Motivación para actuar",
                "Frustración / impotencia", "Orgullo de ser parte",
                "Tristeza / angustia", "Confianza en QSM",
            ],
            "scale_min": 1, "scale_max": 5,
        },
    },
    {
        "code": "P8", "order_index": 13, "type": "single_choice", "is_required": True,
        "label": "¿Cómo describirías tu estado de ánimo actual frente a la situación ambiental en Ecuador?",
        "options": [
            ("Muy optimista", "muy_optimista"), ("Optimista", "optimista"),
            ("Neutral / indiferente", "neutral"), ("Pesimista", "pesimista"),
            ("Muy pesimista / desesperanzado/a", "muy_pesimista"),
        ],
    },
    # ── Sección 3: Percepción de marca QSM ──────────────────────────────────
    {
        "code": "P9", "order_index": 14, "type": "likert_scale", "is_required": True,
        "label": "¿Qué tan familiarizado/a estás con el trabajo y la misión de QSM?",
        "description": "Sección 3: Percepción de marca",
        "validation": {"min": 1, "max": 5, "labels": {"1": "Nada familiar", "5": "Muy familiar"}},
    },
    {
        "code": "P10", "order_index": 15, "type": "matrix", "is_required": True,
        "label": "Valora a QSM en cada dimensión",
        "description": "1 = Totalmente en desacuerdo · 5 = Totalmente de acuerdo",
        "validation": {
            "items": [
                "QSM es creíble", "Comunica claramente",
                "El contenido es relevante para mi vida", "Genera impacto real",
                "Confío en su información", "Se diferencia de otras organizaciones",
            ],
            "scale_min": 1, "scale_max": 5,
        },
    },
    {
        "code": "P11", "order_index": 16, "type": "multiple_choice", "is_required": True,
        "label": "¿Qué tipo de contenido te gustaría que QSM produjera más? (máximo 3)",
        "validation": {"max_choices": 3},
        "options": [
            ("Datos y estadísticas", "datos"), ("Historias de comunidades", "historias"),
            ("Guías de acción ciudadana", "guias"), ("Análisis político", "analisis"),
            ("Videos cortos", "videos"), ("Transmisiones en vivo", "live"),
            ("Reportes técnicos", "reportes"), ("Contenido en kichwa", "kichwa"),
        ],
    },
    {
        "code": "P12", "order_index": 17, "type": "long_text", "is_required": False,
        "label": "¿Por qué sigues o te interesa el contenido de QSM?",
        "description": "Cuéntanos con tus propias palabras (mínimo 50 caracteres).",
        "validation": {"min_length": 50},
        "conditional_logic": {"if": {"question_code": "P5", "operator": "!=", "value": "no_conoce"}},
    },
    # ── Sección 4: Contexto político-ambiental ───────────────────────────────
    {
        "code": "P13", "order_index": 18, "type": "likert_scale", "is_required": True,
        "label": "¿Cuál es tu percepción sobre la minería en Ecuador?",
        "description": "Sección 4: Contexto político-ambiental",
        "validation": {"min": 1, "max": 5, "labels": {"1": "Muy positiva / beneficiosa", "5": "Muy negativa / preocupante"}},
    },
    {
        "code": "P14", "order_index": 19, "type": "likert_scale", "is_required": True,
        "label": "¿Qué tan preocupado/a estás por los impactos de la minería en el agua, ecosistemas y biodiversidad?",
        "validation": {"min": 1, "max": 5, "labels": {"1": "Nada preocupado/a", "5": "Muy preocupado/a"}},
    },
    {
        "code": "P15", "order_index": 20, "type": "multiple_choice", "is_required": True,
        "label": "¿Cuáles impactos de la minería te preocupan más? (máximo 3)",
        "validation": {"max_choices": 3},
        "options": [
            ("Agua y fuentes hídricas", "agua"), ("Biodiversidad y ecosistemas", "biodiversidad"),
            ("Desplazamiento de comunidades", "desplazamiento"), ("Salud pública", "salud"),
            ("Derechos territoriales indígenas", "derechos_indigenas"),
            ("Cambio climático", "clima"), ("Corrupción institucional", "corrupcion"),
            ("Otro", "otro"),
        ],
    },
    {
        "code": "P16", "order_index": 21, "type": "likert_scale", "is_required": True,
        "label": "¿Qué tan segura crees que es la situación de activistas ambientales en Ecuador?",
        "validation": {"min": 1, "max": 5, "labels": {"1": "Muy insegura", "5": "Muy segura"}},
    },
    {
        "code": "P17", "order_index": 22, "type": "multiple_choice", "is_required": True,
        "label": "¿Cuáles son los tres temas más críticos para el futuro de Ecuador? (máximo 3)",
        "validation": {"max_choices": 3},
        "options": [
            ("Agua y minería", "agua_mineria"), ("Derechos indígenas", "derechos_indigenas"),
            ("Cambio climático", "clima"), ("Corrupción", "corrupcion"),
            ("Seguridad ciudadana", "seguridad"), ("Economía y empleo", "economia"),
            ("Educación", "educacion"), ("Salud pública", "salud"), ("Otro", "otro"),
        ],
    },
    # ── Sección 5: Fidelización y compromiso ────────────────────────────────
    {
        "code": "P18", "order_index": 23, "type": "nps", "is_required": True,
        "label": "En una escala del 0 al 10, ¿qué tan probable es que recomiendes seguir a QSM a alguien que conozcas?",
        "description": "Sección 5: Fidelización y compromiso  |  0 = Nada probable · 10 = Muy probable",
        "validation": {"min": 0, "max": 10},
    },
    {
        "code": "P19", "order_index": 24, "type": "multiple_choice", "is_required": True,
        "label": "¿Cuáles de estas acciones estarías dispuesto/a a realizar para apoyar la misión de QSM?",
        "options": [
            ("Compartir contenido en redes", "compartir"), ("Asistir a eventos", "eventos"),
            ("Donar económicamente", "donar"), ("Voluntariar tiempo", "voluntariar"),
            ("Firmar peticiones", "peticiones"), ("Participar en incidencia política", "incidencia"),
            ("Contactar a autoridades locales", "autoridades"), ("Ninguna por ahora", "ninguna"),
        ],
    },
    {
        "code": "P20", "order_index": 25, "type": "long_text", "is_required": False,
        "label": "¿Qué le pedirías a QSM que hiciera diferente o mejor para que te sintieras más comprometido/a?",
        "description": "Tu opinión es muy valiosa (mínimo 50 caracteres).",
        "validation": {"min_length": 50},
    },
]


async def seed():
    from app.database import AsyncSessionLocal
    from app.models import Organization, User
    from app.models.form import Form
    from app.models.question import Question, QuestionOption
    from app.models.campaign import Campaign
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        # Verificar si ya existe la campaña
        result = await db.execute(select(Campaign).where(Campaign.slug == CAMPAIGN_SLUG))
        if result.scalar_one_or_none():
            print(f"✓ La campaña '{CAMPAIGN_SLUG}' ya existe — sin cambios.")
            return

        # Obtener org y usuario admin
        result = await db.execute(select(Organization).where(Organization.slug == ORG_SLUG))
        org = result.scalar_one_or_none()
        if not org:
            print(f"ERROR: Organización '{ORG_SLUG}' no encontrada. Ejecuta seed_dev primero.")
            sys.exit(1)

        result = await db.execute(select(User).where(User.org_id == org.id, User.role == "admin"))
        admin = result.scalar_one_or_none()
        if not admin:
            print("ERROR: No se encontró un usuario admin. Ejecuta seed_dev o seed_admin primero.")
            sys.exit(1)

        # Crear formulario
        form = Form(
            org_id=org.id,
            created_by=admin.id,
            title=FORM_TITLE,
            description="Encuesta para medir estado de ánimo, percepción de marca y fidelización de la comunidad QSM.",
            status="active",
            privacy_notice_text=PRIVACY_NOTICE,
            requires_explicit_consent=False,
        )
        db.add(form)
        await db.flush()

        # Crear preguntas y opciones
        for q_data in QUESTIONS:
            question = Question(
                form_id=form.id,
                code=q_data["code"],
                order_index=q_data["order_index"],
                type=q_data["type"],
                label=q_data["label"],
                description=q_data.get("description"),
                is_required=q_data.get("is_required", True),
                validation=q_data.get("validation", {}),
                conditional_logic=q_data.get("conditional_logic"),
            )
            db.add(question)
            await db.flush()

            for i, (label, value) in enumerate(q_data.get("options", []), start=1):
                db.add(QuestionOption(
                    question_id=question.id,
                    label=label,
                    value=value,
                    order_index=i,
                ))

        # Crear campaña en modo testing (para verificar localmente sin que sea pública)
        campaign = Campaign(
            form_id=form.id,
            created_by=admin.id,
            title="Encuesta de Comunidad QSM 2025",
            slug=CAMPAIGN_SLUG,
            status="testing",
            access_mode="public",
        )
        db.add(campaign)
        await db.commit()

        print(f"✓ Formulario creado: '{FORM_TITLE}'")
        print(f"✓ {len(QUESTIONS)} preguntas cargadas")
        print(f"✓ Campaña creada: slug='{CAMPAIGN_SLUG}' status='testing'")
        print(f"  URL local: http://localhost:3002/c/{CAMPAIGN_SLUG}")


if __name__ == "__main__":
    asyncio.run(seed())
