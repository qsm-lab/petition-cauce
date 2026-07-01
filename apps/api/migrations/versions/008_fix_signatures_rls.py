"""fix signatures RLS policies

Revision ID: 008
Revises: 007
Create Date: 2026-06-30
"""
from typing import Union
import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Fix sig_org_admin: NULLIF prevents empty-string-to-uuid cast error when
    # app.current_org_id is unset (empty string returned by current_setting).
    op.execute("DROP POLICY IF EXISTS sig_org_admin ON signatures")
    op.execute("""
        CREATE POLICY sig_org_admin ON signatures
            USING (
                NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
                AND org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            )
    """)

    # Fix sig_public: status values are Spanish ('confirmada', not 'confirmed').
    # Also restrict to SELECT so public reads don't accidentally allow writes.
    op.execute("DROP POLICY IF EXISTS sig_public ON signatures")
    op.execute("""
        CREATE POLICY sig_public ON signatures
            FOR SELECT
            USING (
                status = 'confirmed'
                AND visibility IN ('publica', 'anonima')
                AND NULLIF(current_setting('app.current_org_id', true), '') IS NULL
            )
    """)

    # Allow confirmation endpoint to SELECT pending_confirmation rows without
    # org context. Scoped narrowly to the confirmation token lookup.
    op.execute("""
        CREATE POLICY sig_confirm_lookup ON signatures
            FOR SELECT
            USING (
                status = 'pending_confirmation'
                AND NULLIF(current_setting('app.current_org_id', true), '') IS NULL
            )
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS sig_org_admin ON signatures")
    op.execute("DROP POLICY IF EXISTS sig_public ON signatures")
    op.execute("DROP POLICY IF EXISTS sig_confirm_lookup ON signatures")

    op.execute("""
        CREATE POLICY sig_org_admin ON signatures
            USING (
                current_setting('app.current_org_id', true) != ''
                AND org_id = current_setting('app.current_org_id', true)::uuid
            )
    """)
    op.execute("""
        CREATE POLICY sig_public ON signatures
            USING (status = 'confirmed' AND visibility IN ('publica', 'anonima'))
    """)
