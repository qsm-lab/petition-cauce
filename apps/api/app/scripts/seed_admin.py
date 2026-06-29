"""Crea el usuario admin inicial leyendo credenciales del entorno.

Uso en producción (una sola vez, vía SSH):
    docker exec petition-api python -m app.scripts.seed_admin

Variables requeridas en .env:
    ADMIN_EMAIL        correo del administrador
    ADMIN_PASSWORD     contraseña segura
    DEFAULT_ORG_SLUG   slug de la organización (por defecto: cauce)
"""
import asyncio
import os
import sys

sys.path.insert(0, "/app")


async def create_initial_admin() -> None:
    from app.database import AsyncSessionLocal
    from app.models import Organization, User
    from app.services.auth_service import hash_password
    from sqlalchemy import select

    email = os.environ.get("ADMIN_EMAIL")
    password = os.environ.get("ADMIN_PASSWORD")
    org_slug = os.environ.get("DEFAULT_ORG_SLUG", "cauce")

    if not email or not password:
        print("ERROR: ADMIN_EMAIL y ADMIN_PASSWORD deben estar definidas en el entorno.")
        sys.exit(1)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Organization).where(Organization.slug == org_slug))
        org = result.scalar_one_or_none()
        if not org:
            org = Organization(name="Cauce Ecuador", slug=org_slug)
            db.add(org)
            await db.flush()
            print(f"✓ Organización '{org_slug}' creada.")
        else:
            print(f"✓ Organización '{org_slug}' ya existe.")

        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                org_id=org.id,
                email=email,
                password_hash=hash_password(password),
                full_name="Admin Cauce",
                role="admin",
            )
            db.add(user)
            await db.commit()
            print(f"✓ Usuario admin creado: {email}")
        else:
            print(f"✓ Usuario admin ya existe: {email} — no se modificó.")


if __name__ == "__main__":
    asyncio.run(create_initial_admin())
