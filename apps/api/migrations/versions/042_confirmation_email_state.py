"""correo-recuperacion: estado de envío del correo de confirmación por firma

El correo de confirmación pasa a enviarse fuera de la petición de alta con reintentos
(hardening-campana T1.5). Cada firma lleva su estado de envío.

Las filas existentes NO se reenvían al desplegar: las `pending_confirmation` quedan como
`sent` y el resto como `not_required`. El default de la columna es `not_required`; solo
`create_signature` marca `pending`.

Revision ID: 042
Revises: 041
Create Date: 2026-11-06
"""
from alembic import op
import sqlalchemy as sa

revision = "042"
down_revision = "041"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "signatures",
        sa.Column("confirmation_email_status", sa.String(12), nullable=False, server_default="not_required"),
    )
    op.add_column("signatures", sa.Column("confirmation_email_attempts", sa.SmallInteger(), nullable=False, server_default="0"))
    op.add_column("signatures", sa.Column("confirmation_email_next_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("signatures", sa.Column("confirmation_email_claimed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("signatures", sa.Column("confirmation_email_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE signatures SET confirmation_email_status = 'sent' WHERE status = 'pending_confirmation'")
    op.execute(
        "CREATE INDEX ix_sig_confirmation_email_due ON signatures (confirmation_email_next_at) "
        "WHERE confirmation_email_status IN ('pending', 'failed', 'sending')"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_sig_confirmation_email_due")
    for col in (
        "confirmation_email_sent_at",
        "confirmation_email_claimed_at",
        "confirmation_email_next_at",
        "confirmation_email_attempts",
        "confirmation_email_status",
    ):
        op.drop_column("signatures", col)
