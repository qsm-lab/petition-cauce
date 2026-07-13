"""fix consents_org_admin: guard NULLIF antes del cast a uuid

consents_org_admin usaba `current_setting(...) <> ''` sin NULLIF, el mismo
patrón que sig_org_admin tenía antes de la migración 008 (que sí lo corrigió
para signatures). Bajo RLS, un `SET LOCAL app.current_org_id = '<uuid>'`
transaccional (usado por submit_signature para autorizar el INSERT en
consents) dentro de una conexión pooleada revierte a cadena vacía (no NULL)
al terminar esa transacción — current_setting(..., true) entonces devuelve
'', y sin NULLIF el cast `''::uuid` en cualquier query posterior sobre esa
misma conexión pooleada revienta con InvalidTextRepresentationError. Puerto
del fix de dev (migración 021) a esta rama basada en origin/main.

Revision ID: 031
Revises: 030
Create Date: 2026-07-13
"""
from alembic import op

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("DROP POLICY IF EXISTS consents_org_admin ON consents")
    op.execute("""
        CREATE POLICY consents_org_admin ON consents
            USING (
                NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
                AND org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
    """)


def downgrade():
    op.execute("DROP POLICY IF EXISTS consents_org_admin ON consents")
    op.execute("""
        CREATE POLICY consents_org_admin ON consents
            USING (
                current_setting('app.current_org_id', true) != ''
                AND org_id = current_setting('app.current_org_id', true)::uuid
            )
    """)
