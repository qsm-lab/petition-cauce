import io
import csv
import uuid
from datetime import date, datetime, timezone
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.crypto import PIIDecryptError, decrypt_pii
from app.models.signature import Signature
from app.models.pii_export_audit import PiiExportAudit


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


def _visible_name(sig: Signature, role: str) -> str | None:
    """El nombre se oculta a 'gestor' cuando la firma es secreta.

    'admin' (operador de plataforma) sí la ve — necesario para revisión de
    fraude/soporte. La firma secreta nunca sale en el feed público ni en la
    descarga absoluta de todos modos (export_absoluto la excluye siempre).
    """
    if role != "admin" and sig.visibility == "secreta":
        return None
    return sig.name


def _apply_provincia_filter(filters: list, provincia: str | None) -> None:
    """'internacional' agrupa todas las firmas con country IS NOT NULL."""
    if provincia == "internacional":
        filters.append(Signature.country.isnot(None))
    elif provincia:
        filters.append(Signature.provincia == provincia)


class AdminSignatureService:
    @staticmethod
    async def list_signatures(
        db: AsyncSession,
        campaign_id: uuid.UUID,
        org_id: uuid.UUID | None,
        campaign_title: str,
        campaign_slug: str,
        role: str,
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
        _apply_provincia_filter(filters, provincia)
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
                    "name": _visible_name(sig, role),
                    "org_name": sig.org_name,
                    "signer_type": sig.signer_type,
                    "provincia": sig.provincia,
                    "country": sig.country,
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
        role: str,
        provincia: str | None = None,
        visibility: str | None = None,
        status: str | None = None,
    ) -> StreamingResponse:
        filters = [Signature.campaign_id == campaign_id]
        if org_id is not None:
            filters.append(Signature.org_id == org_id)
        _apply_provincia_filter(filters, provincia)
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
            # PII solo enmascarada: el export completo es la descarga absoluta
            # (autorización reforzada, ver export_absoluto)
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
                _visible_name(sig, role) or "",
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

    @staticmethod
    async def export_absoluto(
        db: AsyncSession,
        campaign_id: uuid.UUID,
        org_id: uuid.UUID,
        slug: str,
        user_id: uuid.UUID,
        admin_email: str,
        ip_hmac: str,
    ) -> tuple[StreamingResponse, int, int]:
        """Descarga con PII sin enmascarar para armar el documento de entrega.

        Excluye SIEMPRE `visibility='secreta'` — el formulario le promete a
        ese firmante que su firma "no se incluirá en el documento de entrega
        oficial a autoridades" (StepForm.tsx). Solo firmas confirmadas.
        Registra la operación en pii_export_audit (sin PII) y retorna el
        conteo de filas + de secretas excluidas para la notificación.
        """
        base_filters = [
            Signature.campaign_id == campaign_id,
            Signature.org_id == org_id,
            Signature.status == "confirmed",
        ]
        result = await db.execute(
            select(Signature)
            .where(*base_filters, Signature.visibility != "secreta")
            .order_by(Signature.created_at.desc())
        )
        signatures = result.scalars().all()

        secret_count_q = await db.execute(
            select(func.count(Signature.id)).where(*base_filters, Signature.visibility == "secreta")
        )
        secret_excluded_count = secret_count_q.scalar_one()

        export_id = uuid.uuid4()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "nombre", "org", "cedula", "email", "provincia", "pais",
            "tipo_firma", "estado", "confirmada_el", "registrada_el", "export_id",
        ])
        for sig in signatures:
            cedula = ""
            email = ""
            try:
                if sig.cedula_encrypted:
                    cedula = decrypt_pii(sig.cedula_encrypted, ref=str(sig.id))
                email = decrypt_pii(sig.email_encrypted, ref=str(sig.id))
            except PIIDecryptError:
                pass
            writer.writerow([
                str(sig.id),
                sig.name or "",
                sig.org_name or "",
                cedula,
                email,
                sig.provincia or "",
                sig.country or "",
                sig.visibility,
                sig.status,
                sig.confirmed_at.isoformat() if sig.confirmed_at else "",
                sig.created_at.isoformat(),
                str(export_id),
            ])

        now = datetime.now(timezone.utc)
        writer.writerow([
            "SELLO_DESCARGA", f"Realizada por: {admin_email}", "", "", "",
            "", "", "", "", now.isoformat(), "", str(export_id),
        ])

        db.add(PiiExportAudit(
            id=export_id,
            campaign_id=campaign_id,
            org_id=org_id,
            user_id=user_id,
            ip_hmac=ip_hmac,
            row_count=len(signatures),
            secret_excluded_count=secret_excluded_count,
        ))
        await db.commit()

        filename = f"firmas-entrega-absoluta-{slug}-{date.today().isoformat()}.csv"
        response = StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
        return response, len(signatures), secret_excluded_count
