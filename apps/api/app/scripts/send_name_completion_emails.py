"""Remediación puntual: pide completar el nombre de firmas con name=null o
incompleto (una sola palabra), originadas por el bug ya corregido en
signature_service.create_signature. Excluye visibility='secreta' — su firma
nunca integra el documento de entrega, así que la justificación del email
no aplica. Uso:

    docker exec petition-api-dev python -m app.scripts.send_name_completion_emails --slug <slug> --dry-run
    docker exec petition-api-dev python -m app.scripts.send_name_completion_emails --slug <slug>
    docker exec petition-api-dev python -m app.scripts.send_name_completion_emails --slug <slug> --force
"""
import argparse
import asyncio
import secrets
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, "/app")


def _token_still_valid(sig) -> bool:
    if not sig.completion_token or not sig.completion_token_expires_at:
        return False
    exp = sig.completion_token_expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp > datetime.now(timezone.utc)


async def run(slug: str, dry_run: bool, force: bool) -> None:
    from sqlalchemy import select, text as sa_text
    from app.database import AsyncSessionLocal
    from app.models.campaign import Campaign
    from app.models.organization import Organization
    from app.models.signature import Signature
    from app.crypto import decrypt_pii, PIIDecryptError
    from app.services.email_service import send_name_completion_email
    from app.services.signature_service import COMPLETION_TOKEN_TTL_DAYS

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Campaign).where(Campaign.slug == slug))
        campaign = result.scalar_one_or_none()
        if not campaign:
            print(f"Campaña '{slug}' no encontrada.")
            return

        # Session-scoped (no LOCAL): este proceso es de un solo uso, no hay
        # pool compartido con otras requests — a diferencia del bypass usado
        # en la API, aquí es seguro fijarlo para toda la sesión del script.
        await db.execute(
            sa_text("SELECT set_config('app.current_org_id', :oid, false)"),
            {"oid": str(campaign.org_id)},
        )

        org_result = await db.execute(select(Organization).where(Organization.id == campaign.org_id))
        org = org_result.scalar_one_or_none()

        result = await db.execute(
            select(Signature).where(
                Signature.campaign_id == campaign.id,
                Signature.status.in_(["confirmed", "pending_confirmation"]),
                Signature.anulada_at.is_(None),
                Signature.visibility != "secreta",
            )
        )
        candidates = [
            sig for sig in result.scalars().all()
            if not sig.name or " " not in sig.name.strip()
        ]
        if not force:
            candidates = [sig for sig in candidates if not _token_still_valid(sig)]

        print(f"Campaña: {campaign.title} ({campaign.slug})")
        print(f"Candidatos (nombre null/incompleto, excluye secreta, excluye ya-enviados): {len(candidates)}")
        for sig in candidates:
            print(f"  - {sig.id} | status={sig.status} | visibility={sig.visibility} | name={sig.name!r}")

        if dry_run:
            print("\n[dry-run] no se envía ningún email ni se modifica nada.")
            return

        sent = 0
        for sig in candidates:
            try:
                email = decrypt_pii(sig.email_encrypted, ref=str(sig.id))
            except PIIDecryptError:
                print(f"  ! No se pudo desencriptar el email de {sig.id}, se omite")
                continue

            token = secrets.token_hex(16)
            sig.completion_token = token
            sig.completion_token_expires_at = datetime.now(timezone.utc) + timedelta(days=COMPLETION_TOKEN_TTL_DAYS)
            await db.commit()

            await send_name_completion_email(
                to_email=email,
                token=token,
                campaign_title=campaign.petition_title or campaign.title,
                campaign_slug=campaign.slug,
                org_name=org.name if org else "",
                org_logo_url=(org.logo_url or "") if org else "",
                org_contact_email=(org.contact_email or "") if org else "",
            )
            sent += 1

        print(f"\nEnviados: {sent}/{len(candidates)}")


def main():
    parser = argparse.ArgumentParser(description="Remediación: solicita completar nombre incompleto/nulo")
    parser.add_argument("--slug", required=True, help="Slug de la campaña")
    parser.add_argument("--dry-run", action="store_true", help="Solo lista candidatos, no envía ni modifica nada")
    parser.add_argument("--force", action="store_true", help="Reenvía aunque ya tengan un token de completar vigente")
    args = parser.parse_args()
    asyncio.run(run(args.slug, args.dry_run, args.force))


if __name__ == "__main__":
    main()
