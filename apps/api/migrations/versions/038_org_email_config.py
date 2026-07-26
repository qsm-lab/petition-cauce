"""config-email-org: tabla org_email_config (proveedor de email por organización)

Configuración de proveedor/credenciales/remitente/cuota por organización.
Credenciales cifradas en reposo (sec:v1:) con clave dedicada. RLS con el guard
NULLIF correcto (mismo patrón que consents 031 / arco_requests 037), nunca el
patrón `!= '' AND ::uuid` que falla con cadena vacía.

Los campos cosméticos de remitente por campaña (sender_from/reply_to/display_name)
viven en `campaigns.meta` — no requieren columnas nuevas.

Revision ID: 038
Revises: 037
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "org_email_config",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False, unique=True),
        sa.Column("provider", sa.String(20), nullable=False, server_default="resend"),
        sa.Column("credentials_encrypted", sa.Text(), nullable=True),
        sa.Column("plan", sa.String(20), nullable=True),
        sa.Column("daily_quota", sa.Integer(), nullable=True),
        sa.Column("monthly_quota", sa.Integer(), nullable=True),
        sa.Column("default_from", sa.String(255), nullable=True),
        sa.Column("default_reply_to", sa.String(255), nullable=True),
        sa.Column("default_display_name", sa.String(255), nullable=True),
        sa.Column("allowed_domains", JSONB(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_org_email_config_org_id", "org_email_config", ["org_id"])

    op.execute("ALTER TABLE org_email_config ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY org_email_config_org_admin ON org_email_config
            USING (
                NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
                AND org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
            WITH CHECK (
                NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
                AND org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
    """)
    op.execute("""
        CREATE POLICY org_email_config_platform_admin ON org_email_config
            USING (current_setting('app.is_platform_admin', true) = 'true')
            WITH CHECK (current_setting('app.is_platform_admin', true) = 'true')
    """)


def downgrade():
    op.execute("DROP POLICY IF EXISTS org_email_config_platform_admin ON org_email_config")
    op.execute("DROP POLICY IF EXISTS org_email_config_org_admin ON org_email_config")
    op.execute("ALTER TABLE org_email_config DISABLE ROW LEVEL SECURITY")
    op.drop_index("idx_org_email_config_org_id", table_name="org_email_config")
    op.drop_table("org_email_config")
