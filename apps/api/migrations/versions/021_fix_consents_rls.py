"""fix consents_org_admin RLS: NULLIF guard against empty-string-to-uuid cast

Mismo bug que 008 ya corrigió para signatures.sig_org_admin, nunca aplicado a
consents.consents_org_admin. Postgres no garantiza cortocircuito de AND/OR al
evaluar políticas RLS combinadas — cuando app.current_org_id no está seteado
(cadena vacía), el planner puede igual evaluar el cast `::uuid` y fallar con
`invalid input syntax for type uuid: ""`. Expuesto por derechos-arco, que es
el primer flujo en tocar `consents` tras alternar app.current_org_id dentro
de la misma sesión (verificación de identidad pública -> escritura con
contexto de org -> siguiente transacción sin contexto).

Revision ID: 021
Revises: 020
Create Date: 2026-07-12
"""
from alembic import op

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP POLICY IF EXISTS consents_org_admin ON consents")
    op.execute("""
        CREATE POLICY consents_org_admin ON consents
            USING (
                NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
                AND org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS consents_org_admin ON consents")
    op.execute("""
        CREATE POLICY consents_org_admin ON consents
            USING (
                current_setting('app.current_org_id', true) != ''
                AND org_id = current_setting('app.current_org_id', true)::uuid
            )
    """)
