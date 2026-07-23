"""retención de datos: signatures.anonymized_at + tabla retention_runs

Job de retención (diario, APScheduler) anonimiza firmas cuando superan
`privacy_config.retention_days` contados desde el evento de ciclo de vida
`entrega` (o desde `created_at` si la campaña aún no llegó a esa etapa).

Revision ID: 018
Revises: 017
Create Date: 2026-07-09
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("signatures", sa.Column("anonymized_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("idx_signatures_anonymized_at", "signatures", ["campaign_id", "anonymized_at"])

    op.create_table(
        "retention_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trigger", sa.String(20), nullable=False),
        sa.Column("campaigns_evaluated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("signatures_anonymized", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("detail", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.CheckConstraint("trigger IN ('scheduled', 'manual')", name="ck_retention_runs_trigger"),
    )


def downgrade() -> None:
    op.drop_table("retention_runs")
    op.drop_index("idx_signatures_anonymized_at", table_name="signatures")
    op.drop_column("signatures", "anonymized_at")
