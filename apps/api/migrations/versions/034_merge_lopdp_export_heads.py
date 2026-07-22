"""merge heads: cadena LOPDP (018-022) y cadena export-entrega (030-033)

Ambas cadenas partieron de 017 en ramas separadas (dev vs main) que se
reconciliaron en sesión 34. Revisión de solo-merge, sin cambios de schema.

Revision ID: 034
Revises: 022, 033
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "034"
down_revision = ("022", "033")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
