"""add country to signatures

Revision ID: 010
Revises: 009
Create Date: 2026-07-01
"""
import sqlalchemy as sa
from alembic import op

revision: str = "010"
down_revision: str = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("signatures", sa.Column("country", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("signatures", "country")
