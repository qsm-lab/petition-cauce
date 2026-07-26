"""fix RLS arco_requests: guard NULLIF contra current_org_id vacío

La policy `arco_requests_org_admin` (migración 035) usa el patrón
`current_setting('app.current_org_id', true) != '' AND ...::uuid`, que
PostgreSQL no garantiza cortocircuitar: cuando el GUC vale '' (cadena vacía,
estado en que queda un GUC placeholder tras un `set_config(..., true)` local +
commit, p. ej. tras el alta de firma o el consentimiento de Anuncios), el cast
`''::uuid` puede evaluarse y aborta la consulta con
`invalid input syntax for type uuid: ""`.

Es la MISMA regresión que las migraciones 021/031 corrigieron para `consents`.
Se reescribe la policy con el guard `NULLIF(current_setting(...), '')`, que trata
'' y NULL por igual y nunca castea la cadena vacía.

Descubierto al implementar embudo-post-firma (set_newsletter_consent deja el GUC
en '' en la conexión del pool), pero afecta a cualquier consulta sobre
arco_requests en una conexión reutilizada — bug latente de producción.

Revision ID: 037
Revises: 036
Create Date: 2026-07-24
"""
from alembic import op

revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("DROP POLICY IF EXISTS arco_requests_org_admin ON arco_requests")
    op.execute("""
        CREATE POLICY arco_requests_org_admin ON arco_requests
            USING (
                NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
                AND org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
            WITH CHECK (
                NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
                AND org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
    """)


def downgrade():
    op.execute("DROP POLICY IF EXISTS arco_requests_org_admin ON arco_requests")
    op.execute("""
        CREATE POLICY arco_requests_org_admin ON arco_requests
            USING (
                current_setting('app.current_org_id', true) != ''
                AND org_id = current_setting('app.current_org_id', true)::uuid
            )
            WITH CHECK (
                current_setting('app.current_org_id', true) != ''
                AND org_id = current_setting('app.current_org_id', true)::uuid
            )
    """)
