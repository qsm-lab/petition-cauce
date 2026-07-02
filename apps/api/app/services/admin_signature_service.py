import io
import csv
import uuid
from datetime import date
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.signature import Signature


class AdminSignatureService:
    @staticmethod
    async def list_signatures(
        db: AsyncSession,
        campaign_id: uuid.UUID,
        org_id: uuid.UUID,
        campaign_title: str,
        campaign_slug: str,
        page: int = 1,
        per_page: int = 50,
        provincia: str | None = None,
        visibility: str | None = None,
        status: str | None = None,
    ) -> dict:
        base = [Signature.campaign_id == campaign_id, Signature.org_id == org_id]

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
        org_id: uuid.UUID,
        slug: str,
        provincia: str | None = None,
        visibility: str | None = None,
        status: str | None = None,
    ) -> StreamingResponse:
        filters = [Signature.campaign_id == campaign_id, Signature.org_id == org_id]
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
        writer.writerow(["id", "nombre", "provincia", "visibilidad", "estado", "confirmada_el", "registrada_el"])
        for sig in signatures:
            writer.writerow([
                str(sig.id),
                sig.name or "",
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
