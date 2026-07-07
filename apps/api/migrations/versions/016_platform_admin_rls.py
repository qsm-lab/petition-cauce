"""RLS: políticas de admin de plataforma (rol Encargado multi-org)

La plataforma opera campañas para N organizaciones Responsables. El usuario
con rol 'admin' es el operador de la plataforma y debe poder ver/gestionar
recursos de todas las organizaciones (incluida la reasignación de una campaña
a otra org, que el WITH CHECK implícito de las políticas por-org rechazaba).

`app.is_platform_admin` lo setea get_db_with_org solo cuando user.role='admin'.
Las políticas son permisivas: se suman (OR) a las de aislamiento por org.

Revision ID: 016
Revises: 015
Create Date: 2026-07-08
"""
from alembic import op

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None

_TABLES = ["forms", "campaigns", "signatures", "consents", "categories", "privacy_policies"]


def upgrade():
    for t in _TABLES:
        op.execute(f"""
            CREATE POLICY {t}_platform_admin ON {t}
            USING (current_setting('app.is_platform_admin', true) = 'true')
            WITH CHECK (current_setting('app.is_platform_admin', true) = 'true')
        """)


def downgrade():
    for t in _TABLES:
        op.execute(f"DROP POLICY IF EXISTS {t}_platform_admin ON {t}")
