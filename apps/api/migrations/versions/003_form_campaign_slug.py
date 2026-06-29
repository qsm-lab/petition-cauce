"""campaign_id y slug en formularios; form_id opcional en campañas

Revision ID: 003
Revises: 002
Create Date: 2026-05-11

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Agregar campaign_id a forms (nullable, FK a campaigns)
    op.add_column(
        "forms",
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_forms_campaign_id", "forms", ["campaign_id"])

    # 2. Agregar slug a forms (nullable, único)
    op.add_column("forms", sa.Column("slug", sa.String(100), nullable=True))
    op.create_unique_constraint("uq_forms_slug", "forms", ["slug"])

    # 3. Backfill forms.campaign_id desde campaigns.form_id
    op.execute("""
        UPDATE forms f
        SET campaign_id = c.id
        FROM campaigns c
        WHERE c.form_id = f.id
    """)

    # 4. Hacer campaigns.form_id nullable (antes era NOT NULL)
    op.alter_column("campaigns", "form_id", nullable=True)


def downgrade() -> None:
    op.alter_column("campaigns", "form_id", nullable=False)
    op.drop_constraint("uq_forms_slug", "forms", type_="unique")
    op.drop_index("idx_forms_campaign_id", table_name="forms")
    op.drop_column("forms", "slug")
    op.drop_column("forms", "campaign_id")
