"""revision-datos-al-firmar: nombre y apellido separados en la firma

`signatures.name` sigue siendo el nombre completo compuesto (listado público, export, ARCO y comunicaciones no
cambian). Se añaden `first_name` y `last_name`, nulas: las firmas anteriores no se migran porque no se puede
separar de forma fiable. Los correos usan `first_name` (RAT: solo el primer nombre llega a los proveedores).

Revision ID: 043
Revises: 042
Create Date: 2026-11-10
"""
from alembic import op
import sqlalchemy as sa

revision = "043"
down_revision = "042"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("signatures", sa.Column("first_name", sa.String(120), nullable=True))
    op.add_column("signatures", sa.Column("last_name", sa.String(120), nullable=True))


def downgrade():
    op.drop_column("signatures", "last_name")
    op.drop_column("signatures", "first_name")
