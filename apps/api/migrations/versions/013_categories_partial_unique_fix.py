"""categories: partial unique index + fix bad slugs

Revision ID: 013
Revises: 012
Create Date: 2026-07-06
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Reemplazar el constraint global por un índice parcial que ignora archivadas
    op.drop_constraint("uq_categories_slug_org", "categories", type_="unique")
    op.execute(
        "CREATE UNIQUE INDEX uq_categories_slug_org_active "
        "ON categories (slug, org_id) WHERE archived_at IS NULL"
    )

    # 2. Limpiar nombres con espacios extra
    op.execute("UPDATE categories SET name = TRIM(name) WHERE name != TRIM(name)")

    # 3. Corregir slugs que contengan caracteres no-ASCII (quedaron de versión vieja)
    op.execute(
        r"""
        UPDATE categories
        SET slug = regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        regexp_replace(
                          regexp_replace(
                            regexp_replace(
                              regexp_replace(lower(trim(name)),
                                '[áàäâ]', 'a', 'g'),
                              '[éèëê]', 'e', 'g'),
                            '[íìïî]', 'i', 'g'),
                          '[óòöô]', 'o', 'g'),
                        '[úùüû]', 'u', 'g'),
                      'ñ', 'n', 'g'),
                    '[^a-z0-9]+', '-', 'g')
        WHERE slug ~ '[^a-z0-9\-]'
        """
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_categories_slug_org_active")
    op.create_unique_constraint("uq_categories_slug_org", "categories", ["slug", "org_id"])
