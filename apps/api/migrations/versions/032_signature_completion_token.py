"""signatures: token de completar/validar nombre (remediación histórica)

Remediación puntual: firmas con name=null o incompleto (una sola palabra),
originadas por el bug ya corregido en signature_service.create_signature
(el nombre se descartaba para visibility != 'publica'). completion_token
habilita un flujo público de "completar mi nombre" que además promueve a
'confirmed' las firmas que seguían en pending_confirmation.

Revision ID: 032
Revises: 031
Create Date: 2026-07-13
"""
from alembic import op
import sqlalchemy as sa

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("signatures", sa.Column("completion_token", sa.String(128), nullable=True))
    op.add_column("signatures", sa.Column("completion_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "idx_signatures_completion_token", "signatures", ["completion_token"], unique=True,
        postgresql_where=sa.text("completion_token IS NOT NULL"),
    )


def downgrade():
    op.drop_index("idx_signatures_completion_token", table_name="signatures")
    op.drop_column("signatures", "completion_token_expires_at")
    op.drop_column("signatures", "completion_token")
