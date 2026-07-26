"""embudo-post-firma: newsletter_token + consents.notify_updates_at

Consentimiento de Anuncios post-firma (StepThanks). `newsletter_token` (efímero,
un solo propósito, devuelto al crear la firma) autoriza el PATCH público que
setea `Consent.notify_updates`; `notify_updates_at` registra el momento del
opt-in/opt-off (trazabilidad LOPDP, R11). El campo interno `notify_updates` no
cambia — la denominación de producto pasa a "Anuncios" solo en la UI.

Revision ID: 036
Revises: 035
Create Date: 2026-07-24
"""
from alembic import op
import sqlalchemy as sa

revision = "036"
down_revision = "035"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("signatures", sa.Column("newsletter_token", sa.String(128), nullable=True))
    op.add_column("signatures", sa.Column("newsletter_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "idx_signatures_newsletter_token", "signatures", ["newsletter_token"], unique=True,
        postgresql_where=sa.text("newsletter_token IS NOT NULL"),
    )
    op.add_column("consents", sa.Column("notify_updates_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("consents", "notify_updates_at")
    op.drop_index("idx_signatures_newsletter_token", table_name="signatures")
    op.drop_column("signatures", "newsletter_token_expires_at")
    op.drop_column("signatures", "newsletter_token")
