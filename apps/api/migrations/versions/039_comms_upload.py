"""centro-comunicaciones Fase 2: tabla comms_upload (imágenes del editor)

Registro de auditoría de imágenes subidas desde el editor del centro de
comunicaciones (org_id, campaign_id, path, mime, bytes, created_by). El
binario vive en el volumen del VPS (settings.uploads_dir), no en esta tabla.
RLS con el guard NULLIF correcto (mismo patrón que org_email_config 038 /
arco_requests 037), nunca el patrón viejo `!= '' AND ::uuid` que falla con
cadena vacía.

Revision ID: 039
Revises: 038
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "039"
down_revision = "038"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "comms_upload",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("campaign_id", UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("mime", sa.String(50), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_comms_upload_org_id", "comms_upload", ["org_id"])
    op.create_index("idx_comms_upload_campaign_id", "comms_upload", ["campaign_id"])

    op.execute("ALTER TABLE comms_upload ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY comms_upload_org_admin ON comms_upload
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
        CREATE POLICY comms_upload_platform_admin ON comms_upload
            USING (current_setting('app.is_platform_admin', true) = 'true')
            WITH CHECK (current_setting('app.is_platform_admin', true) = 'true')
    """)


def downgrade():
    op.execute("DROP POLICY IF EXISTS comms_upload_platform_admin ON comms_upload")
    op.execute("DROP POLICY IF EXISTS comms_upload_org_admin ON comms_upload")
    op.execute("ALTER TABLE comms_upload DISABLE ROW LEVEL SECURITY")
    op.drop_index("idx_comms_upload_campaign_id", table_name="comms_upload")
    op.drop_index("idx_comms_upload_org_id", table_name="comms_upload")
    op.drop_table("comms_upload")
