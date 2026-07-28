"""centro-comunicaciones Fase 3: programación + cola multi-día + historial

Tres tablas nuevas: scheduled_send (envío en curso de armado, borrador,
programado o en cola), send_batch (lotes trozados por cuota diaria del
proveedor, referencian signature_ids sin duplicar PII), send_log (historial
de auditoría, solo metadatos — nunca HTML/contenido, R14). RLS con el guard
NULLIF correcto (mismo patrón que 038/039), org_id denormalizado en las tres
para políticas simples sin joins.

Revision ID: 040
Revises: 039
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "040"
down_revision = "039"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "scheduled_send",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("campaign_id", UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("class", sa.String(20), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False, server_default=""),
        sa.Column("body_html", sa.Text(), nullable=False, server_default=""),
        sa.Column("ctas", JSONB(), nullable=False, server_default="[]"),
        sa.Column("include_social", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("audience", JSONB(), nullable=False, server_default="{}"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("recipient_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_scheduled_send_org_id", "scheduled_send", ["org_id"])
    op.create_index("idx_scheduled_send_campaign_id", "scheduled_send", ["campaign_id"])
    op.create_index("idx_scheduled_send_status_scheduled_at", "scheduled_send", ["status", "scheduled_at"])

    op.create_table(
        "send_batch",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("scheduled_send_id", UUID(as_uuid=True), sa.ForeignKey("scheduled_send.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("batch_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("signature_ids", JSONB(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_send_batch_org_id", "send_batch", ["org_id"])
    op.create_index("idx_send_batch_scheduled_send_id", "send_batch", ["scheduled_send_id"])
    op.create_index("idx_send_batch_status", "send_batch", ["status"])

    op.create_table(
        "send_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("campaign_id", UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("scheduled_send_id", UUID(as_uuid=True), sa.ForeignKey("scheduled_send.id"), nullable=True),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("class", sa.String(20), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False, server_default=""),
        sa.Column("recipient_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mode", sa.String(10), nullable=False, server_default="real"),
        sa.Column("trigger", sa.String(10), nullable=False, server_default="manual"),
        sa.Column("triggered_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_send_log_org_id", "send_log", ["org_id"])
    op.create_index("idx_send_log_campaign_id", "send_log", ["campaign_id"])

    for table in ("scheduled_send", "send_batch", "send_log"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY {table}_org_admin ON {table}
                USING (
                    NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
                    AND org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
                )
                WITH CHECK (
                    NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
                    AND org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
                )
        """)
        op.execute(f"""
            CREATE POLICY {table}_platform_admin ON {table}
                USING (current_setting('app.is_platform_admin', true) = 'true')
                WITH CHECK (current_setting('app.is_platform_admin', true) = 'true')
        """)


def downgrade():
    for table in ("send_log", "send_batch", "scheduled_send"):
        op.execute(f"DROP POLICY IF EXISTS {table}_platform_admin ON {table}")
        op.execute(f"DROP POLICY IF EXISTS {table}_org_admin ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.drop_index("idx_send_log_campaign_id", table_name="send_log")
    op.drop_index("idx_send_log_org_id", table_name="send_log")
    op.drop_table("send_log")

    op.drop_index("idx_send_batch_status", table_name="send_batch")
    op.drop_index("idx_send_batch_scheduled_send_id", table_name="send_batch")
    op.drop_index("idx_send_batch_org_id", table_name="send_batch")
    op.drop_table("send_batch")

    op.drop_index("idx_scheduled_send_status_scheduled_at", table_name="scheduled_send")
    op.drop_index("idx_scheduled_send_campaign_id", table_name="scheduled_send")
    op.drop_index("idx_scheduled_send_org_id", table_name="scheduled_send")
    op.drop_table("scheduled_send")
