"""schema inicial qsm_forms

Revision ID: 001
Revises:
Create Date: 2026-04-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("settings", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("role", sa.String(20), nullable=False, server_default="editor"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_users_email", "users", ["email"])

    op.create_table(
        "forms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("privacy_notice_text", sa.Text),
        sa.Column("requires_explicit_consent", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("consent_text", sa.Text),
        sa.Column("consent_version", sa.String(20), server_default="1.0"),
        sa.Column("meta", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_forms_org_id", "forms", ["org_id", "status"])

    op.create_table(
        "questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("form_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("forms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("label", sa.Text, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("is_required", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_pii", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("order_index", sa.Integer, nullable=False),
        sa.Column("validation", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("conditional_logic", postgresql.JSONB),
        sa.Column("meta", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("form_id", "code", name="uq_question_form_code"),
    )
    op.create_index("idx_questions_form_order", "questions", ["form_id", "order_index"])

    op.create_table(
        "question_options",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.Text, nullable=False),
        sa.Column("value", sa.String(255), nullable=False),
        sa.Column("order_index", sa.Integer, nullable=False),
        sa.Column("meta", postgresql.JSONB, server_default="{}"),
    )
    op.create_index("idx_question_options_question", "question_options", ["question_id", "order_index"])

    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("form_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("forms.id"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("access_mode", sa.String(20), nullable=False, server_default="public"),
        sa.Column("starts_at", sa.DateTime(timezone=True)),
        sa.Column("ends_at", sa.DateTime(timezone=True)),
        sa.Column("max_responses", sa.Integer),
        sa.Column("source_platform", sa.String(50)),
        sa.Column("qr_code_data", sa.Text),
        sa.Column("quota_config", postgresql.JSONB, server_default="{}"),
        sa.Column("meta", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_campaigns_slug", "campaigns", ["slug"])
    op.create_index("idx_campaigns_status", "campaigns", ["status"])
    op.create_index("idx_campaigns_form", "campaigns", ["form_id"])

    op.create_table(
        "campaign_allowlist",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255)),
        sa.Column("token", sa.String(128), unique=True, nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="started"),
        sa.Column("session_token", sa.String(128), unique=True, nullable=False),
        sa.Column("device_fingerprint", sa.String(128)),
        sa.Column("ip_hash", sa.String(128)),
        sa.Column("platform_source", sa.String(50)),
        sa.Column("current_question_idx", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_questions", sa.Integer, nullable=False),
        sa.Column("completion_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("time_spent_seconds", sa.Integer),
        sa.Column("meta", postgresql.JSONB, server_default="{}"),
    )
    op.create_unique_constraint("idx_responses_session", "responses", ["session_token"])
    op.create_index("idx_responses_campaign", "responses", ["campaign_id", "status"])
    op.create_index("idx_responses_dedup", "responses", ["campaign_id", "device_fingerprint", "ip_hash"])

    op.create_table(
        "response_answers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("response_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("responses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("questions.id"), nullable=False),
        sa.Column("question_code", sa.String(50), nullable=False),
        sa.Column("question_type", sa.String(50), nullable=False),
        sa.Column("value_text", sa.Text),
        sa.Column("value_number", sa.Numeric),
        sa.Column("value_choice", sa.String(255)),
        sa.Column("value_choices", postgresql.ARRAY(sa.Text)),
        sa.Column("value_matrix", postgresql.JSONB),
        sa.Column("answered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("time_on_question_seconds", sa.Integer),
        sa.UniqueConstraint("response_id", "question_id", name="uq_answer_response_question"),
    )
    op.create_index("idx_answers_response", "response_answers", ["response_id"])
    op.create_index("idx_answers_question", "response_answers", ["question_id"])

    op.create_table(
        "privacy_consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("response_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("responses.id", ondelete="SET NULL")),
        sa.Column("consent_text_hash", sa.String(128), nullable=False),
        sa.Column("consent_version", sa.String(20), nullable=False),
        sa.Column("ip_hash", sa.String(128)),
        sa.Column("device_fingerprint", sa.String(128)),
        sa.Column("consented_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_consents_campaign", "privacy_consents", ["campaign_id"])

    op.create_table(
        "exports_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("format", sa.String(20), nullable=False),
        sa.Column("anonymized", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("filters_applied", postgresql.JSONB, server_default="{}"),
        sa.Column("row_count", sa.Integer),
        sa.Column("file_size_bytes", sa.Integer),
        sa.Column("exported_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Triggers updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    for table in ("forms", "campaigns", "users"):
        op.execute(f"""
            CREATE TRIGGER trg_{table}_updated_at
                BEFORE UPDATE ON {table}
                FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        """)

    # Insertar organización inicial QSM
    op.execute("INSERT INTO organizations (name, slug) VALUES ('Quito Sin Minería', 'qsm')")


def downgrade() -> None:
    for table in ("exports_log", "privacy_consents", "response_answers", "responses",
                  "campaign_allowlist", "campaigns", "question_options", "questions",
                  "forms", "users", "organizations"):
        op.drop_table(table)
    op.execute("DROP FUNCTION IF EXISTS update_updated_at CASCADE")
