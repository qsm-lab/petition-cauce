"""modelo base: processing_contracts, signatures, consents, privacy_config, lifecycle_events, domains

Revision ID: 006
Revises: 005
Create Date: 2026-06-30
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # T1.1 — processing_contracts
    op.create_table(
        "processing_contracts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("contract_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content_text", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="borrador"),
        sa.Column("draft_url", sa.Text, nullable=True),
        sa.Column("signed_url", sa.Text, nullable=True),
        sa.Column("validation_token", postgresql.UUID(as_uuid=True), nullable=False,
                  unique=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signed_by_name", sa.String(255), nullable=True),
        sa.Column("signed_by_email", sa.String(255), nullable=True),
        sa.Column("email_delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "contract_type IN ('encargo_tratamiento', 'dpa')",
            name="ck_processing_contracts_type",
        ),
        sa.CheckConstraint(
            "status IN ('borrador', 'enviado_firma', 'firmado', 'revocado')",
            name="ck_processing_contracts_status",
        ),
    )

    # T1.1 — trigger de inmutabilidad al firmar
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_contract_update_when_signed()
        RETURNS TRIGGER AS $$
        BEGIN
            IF OLD.signed_at IS NOT NULL THEN
                IF NOT (
                    NEW.status = 'revocado' AND OLD.status != 'revocado'
                    AND NEW.id                  = OLD.id
                    AND NEW.org_id              = OLD.org_id
                    AND NEW.contract_type       = OLD.contract_type
                    AND NEW.title               = OLD.title
                    AND NEW.content_text        = OLD.content_text
                    AND NEW.validation_token    = OLD.validation_token
                    AND NEW.signed_at           IS NOT DISTINCT FROM OLD.signed_at
                    AND NEW.signed_by_name      IS NOT DISTINCT FROM OLD.signed_by_name
                    AND NEW.signed_by_email     IS NOT DISTINCT FROM OLD.signed_by_email
                    AND NEW.email_delivered_at  IS NOT DISTINCT FROM OLD.email_delivered_at
                    AND NEW.draft_url           IS NOT DISTINCT FROM OLD.draft_url
                    AND NEW.signed_url          IS NOT DISTINCT FROM OLD.signed_url
                ) THEN
                    RAISE EXCEPTION
                        'Contrato firmado es inmutable. Solo se permite revocar (status = revocado).';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_processing_contracts_immutable
            BEFORE UPDATE ON processing_contracts
            FOR EACH ROW EXECUTE FUNCTION prevent_contract_update_when_signed();
    """)

    # T1.2 — extender users (R4, R5)
    op.add_column("users", sa.Column("status", sa.String(20), nullable=False, server_default="activo"))
    op.add_column("users", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column(
        "archived_by", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id"), nullable=True,
    ))
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'gestor'")
    op.execute("ALTER TABLE users ADD CONSTRAINT ck_users_role CHECK (role IN ('admin', 'gestor', 'editor'))")

    # T1.3 — extender organizations (R6)
    op.add_column("organizations", sa.Column("domain", sa.String(255), nullable=True))
    op.add_column("organizations", sa.Column("rep_name", sa.String(255), nullable=True))
    op.add_column("organizations", sa.Column("status", sa.String(20), nullable=False, server_default="pendiente"))
    op.add_column("organizations", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organizations", sa.Column(
        "archived_by", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id"), nullable=True,
    ))
    op.execute(
        "ALTER TABLE organizations ADD CONSTRAINT ck_organizations_status "
        "CHECK (status IN ('verificada', 'pendiente', 'archivada'))"
    )

    # T1.4 — extender campaigns (R7–R10)
    op.add_column("campaigns", sa.Column(
        "processing_contract_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("processing_contracts.id"), nullable=True,
    ))
    op.add_column("campaigns", sa.Column("signer_type", sa.String(10), nullable=False, server_default="natural"))
    op.add_column("campaigns", sa.Column("category", sa.String(50), nullable=True))
    op.add_column("campaigns", sa.Column("goal_count", sa.Integer, nullable=True))
    op.add_column("campaigns", sa.Column("authority", sa.Text, nullable=True))
    op.add_column("campaigns", sa.Column("asks", postgresql.JSONB, server_default="[]"))
    op.add_column("campaigns", sa.Column("petition_body", postgresql.JSONB, server_default="{}"))
    op.add_column("campaigns", sa.Column("hero_image_url", sa.Text, nullable=True))
    op.add_column("campaigns", sa.Column("lifecycle_stage", sa.SmallInteger, nullable=False, server_default="0"))
    op.add_column("campaigns", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaigns", sa.Column(
        "archived_by", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("users.id"), nullable=True,
    ))
    op.execute(
        "ALTER TABLE campaigns ADD CONSTRAINT ck_campaigns_signer_type "
        "CHECK (signer_type IN ('natural', 'org', 'both'))"
    )

    # T1.5 — tabla signatures (R11, R12)
    op.create_table(
        "signatures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("email_encrypted", sa.Text, nullable=False),
        sa.Column("email_hash", sa.String(128), nullable=False),
        sa.Column("cedula_encrypted", sa.Text, nullable=True),
        sa.Column("cedula_hash", sa.String(128), nullable=True),
        sa.Column("provincia", sa.String(100), nullable=True),
        sa.Column("signer_type", sa.String(10), nullable=False, server_default="natural"),
        sa.Column("org_name", sa.String(500), nullable=True),
        sa.Column("org_name_hash", sa.String(128), nullable=True),
        sa.Column("visibility", sa.String(10), nullable=False, server_default="anonima"),
        sa.Column("status", sa.String(25), nullable=False, server_default="pending_confirmation"),
        sa.Column("source", sa.String(50), nullable=True),
        sa.Column("confirmation_token", sa.String(128), unique=True, nullable=True),
        sa.Column("confirmation_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_hmac", sa.String(128), nullable=True),
        sa.Column("anulada_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("anulada_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("signer_type IN ('natural', 'org')", name="ck_signatures_signer_type"),
        sa.CheckConstraint("visibility IN ('publica', 'anonima', 'secreta')", name="ck_signatures_visibility"),
        sa.CheckConstraint(
            "status IN ('pending_confirmation', 'confirmed', 'anulada')",
            name="ck_signatures_status",
        ),
    )

    # T1.6 — índices únicos parciales (R13)
    op.execute(
        "CREATE UNIQUE INDEX uq_sig_email_natural ON signatures (campaign_id, email_hash) "
        "WHERE signer_type = 'natural'"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_sig_cedula_natural ON signatures (campaign_id, cedula_hash) "
        "WHERE signer_type = 'natural'"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_sig_email_org ON signatures (campaign_id, email_hash) "
        "WHERE signer_type = 'org'"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_sig_orgname ON signatures (campaign_id, org_name_hash) "
        "WHERE signer_type = 'org' AND org_name_hash IS NOT NULL"
    )

    # T1.7 — RLS signatures (R16)
    op.execute("ALTER TABLE signatures ENABLE ROW LEVEL SECURITY")
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

    # T1.8 — tabla consents + RLS (R17–R19)
    op.create_table(
        "consents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("signature_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("signatures.id"), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("text_snapshot", sa.Text, nullable=False),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("legal_basis", sa.String(100), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("ip_hmac", sa.String(128), nullable=True),
        sa.Column("subscribe_newsletter", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.execute("ALTER TABLE consents ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY consents_org_admin ON consents
            USING (
                current_setting('app.current_org_id', true) != ''
                AND org_id = current_setting('app.current_org_id', true)::uuid
            )
    """)

    # T1.9 — tabla privacy_config (R20, R21)
    op.create_table(
        "privacy_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"),
                  nullable=False, unique=True),
        sa.Column("aviso_privacidad", sa.Text, nullable=False),
        sa.Column("base_legal", sa.String(100), nullable=False),
        sa.Column("retention_days", sa.Integer, nullable=False, server_default="365"),
        sa.Column("data_contact_name", sa.String(255), nullable=True),
        sa.Column("data_contact_email", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # T1.10 — tabla lifecycle_events (R22, R23)
    op.create_table(
        "lifecycle_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("stage", sa.String(20), nullable=False),
        sa.Column("stage_index", sa.SmallInteger, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("registered_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.CheckConstraint(
            "stage IN ('lanzada', 'recoleccion', 'entrega', 'dialogo', 'decision')",
            name="ck_lifecycle_events_stage",
        ),
    )

    # T1.11 — tabla domains (R25)
    op.create_table(
        "domains",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("host", sa.String(255), nullable=False, unique=True),
        sa.Column("tls_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("tls_status IN ('pending', 'active', 'error')", name="ck_domains_tls_status"),
    )

    # T1.12 — índices generales (R29)
    op.create_index("idx_signatures_campaign_status", "signatures", ["campaign_id", "status"])
    op.create_index("idx_signatures_campaign_visibility", "signatures", ["campaign_id", "visibility"])
    op.create_index("idx_signatures_email_hash", "signatures", ["email_hash"])
    op.create_index("idx_consents_signature_id", "consents", ["signature_id"])
    op.create_index("idx_consents_campaign_id", "consents", ["campaign_id"])
    op.create_index("idx_lifecycle_events_campaign", "lifecycle_events", ["campaign_id", "registered_at"])
    op.create_index("idx_domains_host", "domains", ["host"])
    op.create_index("idx_processing_contracts_org", "processing_contracts", ["org_id"])
    op.create_index("idx_processing_contracts_token", "processing_contracts", ["validation_token"])

    # T1.13 — extender trigger update_updated_at (R30)
    for table in ("signatures", "privacy_config", "processing_contracts"):
        op.execute(f"""
            CREATE TRIGGER trg_{table}_updated_at
                BEFORE UPDATE ON {table}
                FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        """)


def downgrade() -> None:
    # Drops de tablas nuevas (orden inverso de dependencias)
    op.drop_table("domains")
    op.drop_table("lifecycle_events")
    op.drop_table("privacy_config")
    op.drop_table("consents")
    op.drop_table("signatures")

    # Revertir campaigns
    op.execute("ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS ck_campaigns_signer_type")
    for col in (
        "archived_by", "archived_at", "lifecycle_stage", "hero_image_url",
        "petition_body", "asks", "authority", "goal_count", "category",
        "signer_type", "processing_contract_id",
    ):
        op.drop_column("campaigns", col)

    # Revertir organizations
    op.execute("ALTER TABLE organizations DROP CONSTRAINT IF EXISTS ck_organizations_status")
    for col in ("archived_by", "archived_at", "status", "rep_name", "domain"):
        op.drop_column("organizations", col)

    # Revertir users
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_role")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'editor'")
    for col in ("archived_by", "archived_at", "status"):
        op.drop_column("users", col)

    # Drop processing_contracts (ya sin FK desde campaigns)
    op.drop_table("processing_contracts")
    op.execute("DROP FUNCTION IF EXISTS prevent_contract_update_when_signed CASCADE")
