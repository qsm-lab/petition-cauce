"""RLS faltante: retention_runs y arco_requests

Hallazgo de sesión 35 (revisión de riesgo pre-PR #16, ya en producción):
estas dos tablas se crearon sin RLS en las migraciones 018/019, lo que
contradice la regla del proyecto de RLS desde la migración inicial.

- retention_runs: no tiene campaign_id/org_id (es un log global del job
  de retención, cruza todas las campañas) — policy única de
  platform_admin, mismo criterio que ya usa retention_service.run_retention
  para escribir en ella.
- arco_requests: se agrega columna org_id denormalizada (mismo patrón que
  pii_export_audit, migración 030), poblada por trigger BEFORE INSERT
  desde campaigns.org_id vía campaign_id — así los ~9 sitios de
  aplicación que ya insertan filas (arco_service.py, admin_signature_service.py)
  no necesitan tocarse, todos corren con app.is_platform_admin o
  app.current_org_id ya seteado por el contexto existente.

Revision ID: 035
Revises: 034
Create Date: 2026-07-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── retention_runs: RLS solo platform_admin (sin columna de scoping por org) ──
    op.execute("ALTER TABLE retention_runs ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY retention_runs_platform_admin ON retention_runs
            USING (current_setting('app.is_platform_admin', true) = 'true')
            WITH CHECK (current_setting('app.is_platform_admin', true) = 'true')
    """)

    # ── arco_requests: columna org_id denormalizada + backfill + trigger ──
    op.add_column(
        "arco_requests",
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=True),
    )
    op.execute("""
        UPDATE arco_requests
        SET org_id = campaigns.org_id
        FROM campaigns
        WHERE campaigns.id = arco_requests.campaign_id
    """)
    op.alter_column("arco_requests", "org_id", nullable=False)
    op.create_index("idx_arco_requests_org_id", "arco_requests", ["org_id"])

    op.execute("""
        CREATE OR REPLACE FUNCTION set_arco_requests_org_id()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.org_id IS NULL THEN
                SELECT org_id INTO NEW.org_id FROM campaigns WHERE id = NEW.campaign_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_arco_requests_org_id
            BEFORE INSERT ON arco_requests
            FOR EACH ROW EXECUTE FUNCTION set_arco_requests_org_id();
    """)

    op.execute("ALTER TABLE arco_requests ENABLE ROW LEVEL SECURITY")
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
    op.execute("""
        CREATE POLICY arco_requests_platform_admin ON arco_requests
            USING (current_setting('app.is_platform_admin', true) = 'true')
            WITH CHECK (current_setting('app.is_platform_admin', true) = 'true')
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS arco_requests_platform_admin ON arco_requests")
    op.execute("DROP POLICY IF EXISTS arco_requests_org_admin ON arco_requests")
    op.execute("ALTER TABLE arco_requests DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TRIGGER IF EXISTS trg_arco_requests_org_id ON arco_requests")
    op.execute("DROP FUNCTION IF EXISTS set_arco_requests_org_id()")
    op.drop_index("idx_arco_requests_org_id", table_name="arco_requests")
    op.drop_column("arco_requests", "org_id")

    op.execute("DROP POLICY IF EXISTS retention_runs_platform_admin ON retention_runs")
    op.execute("ALTER TABLE retention_runs DISABLE ROW LEVEL SECURITY")
