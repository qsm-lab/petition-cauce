"""add signatures UPDATE policy for confirmation flow

Revision ID: 009
Revises: 008
Create Date: 2026-06-30
"""
from typing import Union
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Allow the confirmation endpoint to UPDATE a pending_confirmation signature
    # to confirmada status without requiring org context (token-based flow).
    op.execute("""
        CREATE POLICY sig_confirm_update ON signatures
            FOR UPDATE
            USING (
                status = 'pending_confirmation'
                AND NULLIF(current_setting('app.current_org_id', true), '') IS NULL
            )
            WITH CHECK (
                status = 'confirmed'
                AND NULLIF(current_setting('app.current_org_id', true), '') IS NULL
            )
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS sig_confirm_update ON signatures")
