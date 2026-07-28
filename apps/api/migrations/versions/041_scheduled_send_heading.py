"""centro-comunicaciones: título del mensaje (heading) editable

El H1 del email era fijo por tipo (_COMMS_HEADING hardcodeado en
campaigns.py) — pasa a ser editable por el admin y se persiste en
scheduled_send para reconstruir el email al dispararse (borradores y
programados).

Revision ID: 041
Revises: 040
Create Date: 2026-07-28
"""
from alembic import op
import sqlalchemy as sa

revision = "041"
down_revision = "040"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("scheduled_send", sa.Column("heading", sa.Text(), nullable=False, server_default=""))


def downgrade():
    op.drop_column("scheduled_send", "heading")
