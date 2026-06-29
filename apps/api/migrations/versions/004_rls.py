"""RLS en forms y campaigns; org_id en campaigns

Revision ID: 004
Revises: 003
Create Date: 2026-05-23

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Agregar org_id a campaigns (nullable primero para el backfill)
    op.add_column(
        "campaigns",
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id"),
            nullable=True,
        ),
    )

    # 2. Backfill principal: org_id desde forms.org_id vía form_id
    op.execute("""
        UPDATE campaigns c
        SET org_id = f.org_id
        FROM forms f
        WHERE f.id = c.form_id
          AND c.org_id IS NULL
    """)

    # 3. Backfill fallback: org_id desde users.org_id vía created_by
    #    (para campañas sin form_id — caso teórico pero cubierto)
    op.execute("""
        UPDATE campaigns c
        SET org_id = u.org_id
        FROM users u
        WHERE u.id = c.created_by
          AND c.org_id IS NULL
    """)

    # 4. Hacer NOT NULL ahora que todos los registros tienen valor
    op.alter_column("campaigns", "org_id", nullable=False)

    # 5. Índice para las consultas filtradas por org
    op.create_index("idx_campaigns_org_id", "campaigns", ["org_id"])

    # 6. RLS en forms
    #    La migración corre como javofox (owner) que bypassa RLS por diseño.
    #    petition_app (usuario de servicio, sin BYPASSRLS) quedará sujeto a las políticas.
    op.execute("ALTER TABLE forms ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY forms_org_isolation ON forms
        USING (
            org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
    """)

    # 7. RLS en campaigns
    op.execute("ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY")

    # Política admin: solo campañas de la organización autenticada
    op.execute("""
        CREATE POLICY campaigns_org_isolation ON campaigns
        USING (
            org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
        )
    """)

    # Política pública: campañas publicadas sin contexto de org (rutas /public/)
    op.execute("""
        CREATE POLICY campaigns_public_read ON campaigns
        FOR SELECT
        USING (
            NULLIF(current_setting('app.current_org_id', true), '') IS NULL
            AND status IN ('active', 'online', 'closed')
        )
    """)


def downgrade() -> None:
    # Eliminar políticas y deshabilitar RLS en campaigns
    op.execute("DROP POLICY IF EXISTS campaigns_public_read ON campaigns")
    op.execute("DROP POLICY IF EXISTS campaigns_org_isolation ON campaigns")
    op.execute("ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY")

    # Eliminar políticas y deshabilitar RLS en forms
    op.execute("DROP POLICY IF EXISTS forms_org_isolation ON forms")
    op.execute("ALTER TABLE forms DISABLE ROW LEVEL SECURITY")

    # Eliminar org_id de campaigns
    op.drop_index("idx_campaigns_org_id", table_name="campaigns")
    op.drop_column("campaigns", "org_id")
