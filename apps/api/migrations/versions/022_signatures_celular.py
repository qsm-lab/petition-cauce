"""derechos-arco: celular opcional en signatures

Campo nuevo, aportado voluntariamente por el titular desde el portal de
derechos ARCO (datos personales). Cifrado igual que email/cédula (PII) — sin
hash ni índice, no se usa para búsqueda ni verificación de identidad.

Revision ID: 022
Revises: 021
Create Date: 2026-07-13
"""
import sqlalchemy as sa
from alembic import op

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("signatures", sa.Column("celular_encrypted", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("signatures", "celular_encrypted")
