"""lopdp-base: version en privacy_config

Revision ID: 007
Revises: 006
Create Date: 2026-06-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "privacy_config",
        sa.Column("version", sa.SmallInteger, nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("privacy_config", "version")
