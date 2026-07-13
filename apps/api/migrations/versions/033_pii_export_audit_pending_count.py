"""pii_export_audit: columna pending_included_count

La descarga absoluta ahora incluye firmas pending_confirmation además de
confirmed (a pedido del usuario) — se registra cuántas de las filas
incluidas no habían completado el doble opt-in, para trazabilidad.

Revision ID: 033
Revises: 032
Create Date: 2026-07-13
"""
from alembic import op
import sqlalchemy as sa

revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "pii_export_audit",
        sa.Column("pending_included_count", sa.Integer, nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("pii_export_audit", "pending_included_count")
