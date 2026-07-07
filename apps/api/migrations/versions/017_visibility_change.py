"""signatures: cambio de visibilidad iniciado por admin con confirmación del titular

pending_visibility guarda el cambio solicitado; se aplica solo cuando el
firmante confirma vía token enviado a su email (doble opt-in del cambio).

Revision ID: 017
Revises: 016
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("signatures", sa.Column("pending_visibility", sa.String(10), nullable=True))
    op.add_column("signatures", sa.Column("visibility_change_token", sa.String(128), nullable=True))
    op.add_column("signatures", sa.Column("visibility_change_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "idx_signatures_visibility_token", "signatures", ["visibility_change_token"], unique=True,
        postgresql_where=sa.text("visibility_change_token IS NOT NULL"),
    )


def downgrade():
    op.drop_index("idx_signatures_visibility_token", table_name="signatures")
    op.drop_column("signatures", "visibility_change_expires_at")
    op.drop_column("signatures", "visibility_change_token")
    op.drop_column("signatures", "pending_visibility")
