"""pii_export_audit: auditoría de descargas absolutas de PII (sin PII)

Registra cada descarga completa (cédula/email en claro) hecha desde el
dashboard de firmas para armar el documento de entrega oficial. La tabla
no contiene PII, solo metadata trazable (quién, cuándo, cuántas filas).

Revision ID: 030
Revises: 017
Create Date: 2026-07-13

Nota: numerada 030 (no 018) a propósito — esta rama parte de origin/main
(017 es el head ahí). dev tiene su propia cadena 018-022 (retención,
supresión, ARCO) todavía sin mergear a main. Al reconciliar dev+main habrá
dos heads (022 y 030) que requerirán una migración de merge de Alembic.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "030"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pii_export_audit",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("ip_hmac", sa.String(128), nullable=False),
        sa.Column("row_count", sa.Integer, nullable=False),
        sa.Column("secret_excluded_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pii_export_audit_campaign_id", "pii_export_audit", ["campaign_id"])

    op.execute("ALTER TABLE pii_export_audit ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY pii_export_audit_org_admin ON pii_export_audit
            USING (
                current_setting('app.current_org_id', true) != ''
                AND org_id = current_setting('app.current_org_id', true)::uuid
            )
            WITH CHECK (
                current_setting('app.current_org_id', true) != ''
                AND org_id = current_setting('app.current_org_id', true)::uuid
            )
    """)
    op.execute("""
        CREATE POLICY pii_export_audit_platform_admin ON pii_export_audit
            USING (current_setting('app.is_platform_admin', true) = 'true')
            WITH CHECK (current_setting('app.is_platform_admin', true) = 'true')
    """)


def downgrade():
    op.execute("DROP POLICY IF EXISTS pii_export_audit_platform_admin ON pii_export_audit")
    op.execute("DROP POLICY IF EXISTS pii_export_audit_org_admin ON pii_export_audit")
    op.drop_index("ix_pii_export_audit_campaign_id", table_name="pii_export_audit")
    op.drop_table("pii_export_audit")
