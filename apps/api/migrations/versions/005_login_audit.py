"""Tabla login_audit para trazabilidad de intentos de login

Revision ID: 005
Revises: 004
Create Date: 2026-05-23

"""
from typing import Sequence, Union
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE login_audit (
            id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            email_hmac   VARCHAR(64)  NOT NULL,
            ip_hmac      VARCHAR(64)  NOT NULL,
            user_agent   VARCHAR(512) NOT NULL DEFAULT '',
            result       VARCHAR(10)  NOT NULL
                             CHECK (result IN ('success', 'failure', 'locked')),
            user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
            attempted_at TIMESTAMPTZ  NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX idx_login_audit_email_time
            ON login_audit (email_hmac, attempted_at DESC)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_login_audit_email_time")
    op.execute("DROP TABLE IF EXISTS login_audit")
