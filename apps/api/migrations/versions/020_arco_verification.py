"""derechos-arco: token de verificación de identidad en signatures

La tabla arco_requests ya existe (migración 019, adelantada por
supresion-admin) y se reutiliza tal cual. Esta migración solo agrega el
par de columnas necesarias para el flujo de doble verificación
(email + cédula) que abre la sesión del portal de derechos ARCO.

Revision ID: 020
Revises: 019
Create Date: 2026-07-12
"""
import sqlalchemy as sa
from alembic import op

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("signatures", sa.Column("arco_verification_token", sa.String(128), nullable=True))
    op.add_column("signatures", sa.Column("arco_verification_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint(
        "uq_signatures_arco_verification_token", "signatures", ["arco_verification_token"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_signatures_arco_verification_token", "signatures", type_="unique")
    op.drop_column("signatures", "arco_verification_expires_at")
    op.drop_column("signatures", "arco_verification_token")
