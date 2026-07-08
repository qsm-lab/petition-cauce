import io
import csv
import uuid
from datetime import date
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.crypto import PIIDecryptError, decrypt_pii
from app.models.signature import Signature


def _mask_cedula(cedula: str) -> str:
    """2 primeros + 3 últimos dígitos visibles; el resto en X (ej. 17XXXXX601)."""
    if len(cedula) <= 5:
        return "X" * len(cedula)
    return cedula[:2] + "X" * (len(cedula) - 5) + cedula[-3:]


def _mask_email(email: str) -> str:
    """3 primeros caracteres + dominio visibles (ej. jguXXXXXXX@gmail.com)."""
    local, _, domain = email.partition("@")
    if not domain:
        return "X" * len(email)
    return local[:3] + "X" * max(len(local) - 3, 0) + "@" + domain


class AdminSignatureService:
    @staticmethod
    async def list_signatures(
        db: AsyncSession,
        campaign_id: uuid.UUID,
        org_id: uuid.UUID | None,
        campaign_title: str,
        campaign_slug: str,
        page: int = 1,
        per_page: int = 50,
        provincia: str | None = None,
        visibility: str | None = None,
        status: str | None = None,
    ) -> dict:
        base = [Signature.campaign_id == campaign_id]
        if org_id is not None:
            base.append(Signature.org_id == org_id)

        # Stats son siempre totales de campaña, independientes de filtros opcionales
        stats_q = await db.execute(
            select(
                func.count(Signature.id).filter(Signature.status == "confirmed").label("confirmed"),
                func.count(Signature.id).filter(Signature.status == "pending_confirmation").label("pending"),
                func.count(Signature.id).filter(Signature.status == "anulada").label("anulada"),
            ).where(*base)
        )
        stats = stats_q.one()

        # Filtros opcionales para la tabla y el total paginado
        filters = list(base)
        if provincia:
            filters.append(Signature.provincia == provincia)
        if visibility:
            filters.append(Signature.visibility == visibility)
        if status:
            filters.append(Signature.status == status)

        total_q = await db.execute(select(func.count(Signature.id)).where(*filters))
        total = total_q.scalar_one()

        offset = (page - 1) * per_page
        items_q = await db.execute(
            select(Signature)
            .where(*filters)
            .order_by(Signature.created_at.desc())
            .limit(per_page)
            .offset(offset)
        )
        items = items_q.scalars().all()
        pages = max(1, (total + per_page - 1) // per_page)

        return {
            "campaign_title": campaign_title,
            "campaign_slug": campaign_slug,
            "items": [
                {
                    "id": str(sig.id),
                    "name": sig.name,
                    "provincia": sig.provincia,
                    "visibility": sig.visibility,
                    "pending_visibility": sig.pending_visibility,
                    "status": sig.status,
                    "confirmed_at": sig.confirmed_at.isoformat() if sig.confirmed_at else None,
                    "created_at": sig.created_at.isoformat(),
                }
                for sig in items
            ],
            "total": total,
            "confirmed_count": stats.confirmed,
            "pending_count": stats.pending,
            "anulada_count": stats.anulada,
            "page": page,
            "per_page": per_page,
            "pages": pages,
        }

    @staticmethod
    async def export_csv(
        db: AsyncSession,
        campaign_id: uuid.UUID,
        org_id: uuid.UUID | None,
        slug: str,
        provincia: str | None = None,
        visibility: str | None = None,
        status: str | None = None,
    ) -> StreamingResponse:
        filters = [Signature.campaign_id == campaign_id]
        if org_id is not None:
            filters.append(Signature.org_id == org_id)
        if provincia:
            filters.append(Signature.provincia == provincia)
        if visibility:
            filters.append(Signature.visibility == visibility)
        if status:
            filters.append(Signature.status == status)

        result = await db.execute(
            select(Signature).where(*filters).order_by(Signature.created_at.desc())
        )
        signatures = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "nombre", "cedula_parcial", "email_parcial", "provincia",
            "visibilidad", "estado", "confirmada_el", "registrada_el",
        ])
        for sig in signatures:
            # PII solo enmascarada: el export completo requiere el flujo de
            # descarga especial de fin de campaña (autorización reforzada)
            cedula_parcial = ""
            email_parcial = ""
            try:
                if sig.cedula_encrypted:
                    cedula_parcial = _mask_cedula(decrypt_pii(sig.cedula_encrypted, ref=str(sig.id)))
                if sig.email_encrypted:
                    email_parcial = _mask_email(decrypt_pii(sig.email_encrypted, ref=str(sig.id)))
            except PIIDecryptError:
                pass
            writer.writerow([
                str(sig.id),
                sig.name or "",
                cedula_parcial,
                email_parcial,
                sig.provincia or "",
                sig.visibility,
                sig.status,
                sig.confirmed_at.isoformat() if sig.confirmed_at else "",
                sig.created_at.isoformat(),
            ])

        filename = f"firmas-{slug}-{date.today().isoformat()}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
