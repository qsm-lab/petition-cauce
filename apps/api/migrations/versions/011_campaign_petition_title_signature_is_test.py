"""campaign petition_title + signature is_test

Revision ID: 011
Revises: 010
Create Date: 2026-07-02
"""
import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: str = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Título de la petición (lo que se muestra en el front). Si NULL → usar title.
    op.add_column("campaigns", sa.Column("petition_title", sa.String(500), nullable=True))
    # Firma realizada mientras la campaña estaba en draft (prueba)
    op.add_column("signatures", sa.Column("is_test", sa.Boolean(), nullable=False, server_default="false"))
    # Permitir lectura pública de campañas en borrador (visible con banner "en edición")
    op.execute("""
        DROP POLICY IF EXISTS campaigns_public_read ON campaigns;
        CREATE POLICY campaigns_public_read ON campaigns
            FOR SELECT
            USING (
                NULLIF(current_setting('app.current_org_id', true), '') IS NULL
                AND status IN ('draft', 'active', 'online', 'closed')
            );
    """)


def downgrade() -> None:
    op.execute("""
        DROP POLICY IF EXISTS campaigns_public_read ON campaigns;
        CREATE POLICY campaigns_public_read ON campaigns
            FOR SELECT
            USING (
                NULLIF(current_setting('app.current_org_id', true), '') IS NULL
                AND status IN ('active', 'online', 'closed')
            );
    """)
    op.drop_column("signatures", "is_test")
    op.drop_column("campaigns", "petition_title")
