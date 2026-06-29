"""Script de datos de prueba para desarrollo local."""
import asyncio
import sys

sys.path.insert(0, "/app")


async def seed():
    from app.database import AsyncSessionLocal
    from app.models import Organization, User
    from app.services.auth_service import hash_password
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Organization).where(Organization.slug == "cauce"))
        org = result.scalar_one_or_none()
        if not org:
            org = Organization(name="Cauce Ecuador", slug="cauce")
            db.add(org)
            await db.flush()

        result = await db.execute(select(User).where(User.email == "admin@cauce.local"))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                org_id=org.id,
                email="admin@cauce.local",
                password_hash=hash_password("admin123dev"),
                full_name="Admin Cauce",
                role="admin",
            )
            db.add(user)

        await db.commit()
        print("✓ Seed completado: org 'cauce' + admin@cauce.local (pass: admin123dev)")


if __name__ == "__main__":
    asyncio.run(seed())
