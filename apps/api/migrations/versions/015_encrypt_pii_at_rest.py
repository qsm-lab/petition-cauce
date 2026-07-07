"""cifrado-reposo: cifrar email/cedula legados en texto plano (R8)

Migración de datos, no de schema. Idempotente: detecta el prefijo enc: y no
re-cifra. Requiere PII_ENCRYPTION_KEY en el entorno (el API tampoco arranca
sin ella).

Revision ID: 015
Revises: 014
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None

_BATCH = 500


def upgrade():
    from app.crypto import encrypt_pii

    conn = op.get_bind()
    while True:
        rows = conn.execute(
            sa.text(
                "SELECT id, email_encrypted, cedula_encrypted FROM signatures "
                "WHERE (email_encrypted IS NOT NULL AND email_encrypted NOT LIKE 'enc:%') "
                "   OR (cedula_encrypted IS NOT NULL AND cedula_encrypted NOT LIKE 'enc:%') "
                "LIMIT :batch"
            ),
            {"batch": _BATCH},
        ).fetchall()
        if not rows:
            break
        for sig_id, email, cedula in rows:
            updates = {}
            if email is not None and not email.startswith("enc:"):
                updates["email_encrypted"] = encrypt_pii(email)
            if cedula is not None and not cedula.startswith("enc:"):
                updates["cedula_encrypted"] = encrypt_pii(cedula)
            if updates:
                sets = ", ".join(f"{k} = :{k}" for k in updates)
                conn.execute(
                    sa.text(f"UPDATE signatures SET {sets} WHERE id = :id"),
                    {**updates, "id": sig_id},
                )


def downgrade():
    # Irreversible por diseño: no se restaura PII en texto plano.
    pass
