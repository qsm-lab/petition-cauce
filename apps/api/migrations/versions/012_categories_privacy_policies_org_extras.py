"""categories + privacy_policies + org extras

Revision ID: 012
Revises: 011
Create Date: 2026-07-02
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "012"
down_revision: str = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── organizations: campos adicionales ───────────────────────────────────────
    op.add_column("organizations", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("organizations", sa.Column("logo_url", sa.Text(), nullable=True))
    op.add_column("organizations", sa.Column("contact_email", sa.String(255), nullable=True))
    op.add_column("organizations", sa.Column(
        "domains", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"
    ))

    # ── categories ──────────────────────────────────────────────────────────────
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(60), nullable=False),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_unique_constraint("uq_categories_slug_org", "categories", ["slug", "org_id"])
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE categories TO petition_app;")

    # ── privacy_policies ────────────────────────────────────────────────────────
    op.create_table(
        "privacy_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("aviso_firmante", sa.Text(), nullable=False, server_default=""),
        sa.Column("aviso_organizacion", sa.Text(), nullable=False, server_default=""),
        sa.Column("version", sa.SmallInteger(), nullable=False, server_default="1"),
        sa.Column("base_legal", sa.String(100), nullable=False, server_default="consentimiento_expreso"),
        sa.Column("data_contact_email", sa.String(255), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE privacy_policies TO petition_app;")

    # ── campaigns: vincular política de privacidad ───────────────────────────────
    op.add_column("campaigns", sa.Column(
        "privacy_policy_id",
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey("privacy_policies.id", ondelete="SET NULL"),
        nullable=True,
    ))

    # ── RLS para categorías (solo la org dueña + lectura pública) ───────────────
    op.execute("ALTER TABLE categories ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY categories_org_isolation ON categories
            FOR ALL
            USING (
                org_id IS NULL
                OR org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            );
    """)

    # ── RLS para privacy_policies (solo la org dueña) ───────────────────────────
    op.execute("ALTER TABLE privacy_policies ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY privacy_policies_org_isolation ON privacy_policies
            FOR ALL
            USING (
                org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
            );
    """)


def downgrade() -> None:
    op.drop_column("campaigns", "privacy_policy_id")
    op.execute("DROP POLICY IF EXISTS privacy_policies_org_isolation ON privacy_policies;")
    op.drop_table("privacy_policies")
    op.execute("DROP POLICY IF EXISTS categories_org_isolation ON categories;")
    op.drop_table("categories")
    op.drop_column("organizations", "domains")
    op.drop_column("organizations", "contact_email")
    op.drop_column("organizations", "logo_url")
    op.drop_column("organizations", "description")
