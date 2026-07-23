"""supresion-admin: columnas de archivado en signatures + tabla arco_requests

Ventana de gracia de 15 días para supresión solicitada por canal no digital
(botón "Archivar" en el dashboard de firmas). `arco_requests` se crea aquí
(adelantada de la spec derechos-arco, aún no implementada) porque
supresion-admin la necesita para su auditoría; derechos-arco reutilizará esta
misma tabla cuando se implemente.

Revision ID: 019
Revises: 018
Create Date: 2026-07-11
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("signatures", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("signatures", sa.Column("archived_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("signatures", sa.Column("purge_after", sa.DateTime(timezone=True), nullable=True))
    op.create_index("idx_signatures_purge_after", "signatures", ["purge_after"])

    op.create_table(
        "arco_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("right_type", sa.String(20), nullable=False),
        sa.Column("email_hash", sa.String(128), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result", sa.String(20), nullable=True),
        sa.Column("detail", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.CheckConstraint(
            "right_type IN ('acceso', 'rectificacion', 'supresion', 'oposicion', 'portabilidad')",
            name="ck_arco_requests_right_type",
        ),
        sa.CheckConstraint(
            "result IS NULL OR result IN ('completed', 'expired', 'not_found')",
            name="ck_arco_requests_result",
        ),
    )
    op.create_index("idx_arco_requests_campaign_email", "arco_requests", ["campaign_id", "email_hash"])


def downgrade() -> None:
    op.drop_index("idx_arco_requests_campaign_email", table_name="arco_requests")
    op.drop_table("arco_requests")
    op.drop_index("idx_signatures_purge_after", table_name="signatures")
    op.drop_column("signatures", "purge_after")
    op.drop_column("signatures", "archived_by")
    op.drop_column("signatures", "archived_at")
