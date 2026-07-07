"""consents: agregar columna notify_updates

Revision ID: 014
Revises: 013
Create Date: 2026-07-06
"""
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "consents",
        sa.Column("notify_updates", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("consents", "notify_updates")
