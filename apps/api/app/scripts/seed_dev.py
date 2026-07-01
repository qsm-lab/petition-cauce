"""Script de datos de prueba para desarrollo local."""
import asyncio
import sys
from datetime import datetime, timezone

import sqlalchemy as sa

sys.path.insert(0, "/app")

from app.legal import get_contrato_dev, render_aviso_privacidad, build_aviso_context
from app.legal.retention import RETENTION_CAMPANA_ESTANDAR


async def seed():
    from app.database import AsyncSessionLocal
    from app.models import (
        Organization, User, ProcessingContract,
        Campaign, PrivacyConfig, LifecycleEvent,
    )
    from app.services.auth_service import hash_password
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        # Organización
        result = await db.execute(select(Organization).where(Organization.slug == "cauce"))
        org = result.scalar_one_or_none()
        if not org:
            org = Organization(name="Cauce Ecuador", slug="cauce", status="verificada")
            db.add(org)
            await db.flush()
        elif org.status == "pendiente":
            org.status = "verificada"
            await db.flush()

        # Usuario admin
        result = await db.execute(select(User).where(User.email == "admin@cauce.ec"))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                org_id=org.id,
                email="admin@cauce.ec",
                password_hash=hash_password("admin123dev"),
                full_name="Admin Cauce",
                role="admin",
                status="activo",
            )
            db.add(user)
            await db.flush()

        # Contrato de encargo LOPDP (dev)
        result = await db.execute(
            select(ProcessingContract).where(ProcessingContract.title == "CONTRATO-DEV-001")
        )
        contrato = result.scalar_one_or_none()
        if not contrato:
            contrato = ProcessingContract(
                org_id=org.id,
                contract_type="encargo_tratamiento",
                title="CONTRATO-DEV-001",
                content_text=get_contrato_dev(),
                status="firmado",
                signed_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
                signed_by_name="Admin Dev",
                signed_by_email="admin@cauce.ec",
            )
            db.add(contrato)
            await db.flush()

        # Contexto RLS necesario para INSERT en campaigns (petition_app no tiene BYPASSRLS)
        await db.execute(sa.text(f"SET LOCAL app.current_org_id = '{org.id}'"))

        # Campaña de prueba
        result = await db.execute(select(Campaign).where(Campaign.slug == "campana-dev-001"))
        campana = result.scalar_one_or_none()
        if not campana:
            campana = Campaign(
                org_id=org.id,
                created_by=user.id,
                processing_contract_id=contrato.id,
                title="Campaña de Prueba — Cauce Dev",
                slug="campana-dev-001",
                status="active",
                signer_type="both",
                category="mineria",
                goal_count=10000,
                authority="Ministerio del Ambiente",
                asks=["Suspender concesión minera X", "Declarar zona protegida"],
                petition_body={"texto": "Petición de prueba para desarrollo."},
                lifecycle_stage=1,
            )
            db.add(campana)
            await db.flush()

            # PrivacyConfig — aviso generado con Jinja2
            _aviso_ctx = build_aviso_context(
                campaign=campana,
                org=org,
                retention_days=RETENTION_CAMPANA_ESTANDAR,
                data_contact_email="admin@cauce.ec",
                data_contact_nombre="Admin Cauce",
                aviso_version=1,
            )
            pc = PrivacyConfig(
                campaign_id=campana.id,
                aviso_privacidad=render_aviso_privacidad(_aviso_ctx),
                base_legal="consentimiento_expreso",
                retention_days=RETENTION_CAMPANA_ESTANDAR,
                data_contact_name="Admin Cauce",
                data_contact_email="admin@cauce.ec",
                version=1,
            )
            db.add(pc)

            # Lifecycle events: lanzada → recoleccion
            db.add(LifecycleEvent(
                campaign_id=campana.id,
                stage="lanzada",
                stage_index=0,
                notes="Campaña lanzada en entorno dev.",
                registered_by=user.id,
            ))
            db.add(LifecycleEvent(
                campaign_id=campana.id,
                stage="recoleccion",
                stage_index=1,
                notes="Inicio de recolección de firmas.",
                registered_by=user.id,
            ))

        await db.commit()
        print("✓ Seed completado:")
        print("  - org 'cauce' (verificada)")
        print("  - admin@cauce.ec / admin123dev")
        print("  - CONTRATO-DEV-001 (firmado)")
        print("  - campana-dev-001 (signer_type=both, lifecycle_stage=1)")


if __name__ == "__main__":
    asyncio.run(seed())
