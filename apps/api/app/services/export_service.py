import io
import json
import uuid
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.response import Response, ResponseAnswer
from app.services.anonymizer import anonymize_answers


class ExportService:
    @staticmethod
    async def export(
        db: AsyncSession,
        campaign_id: str,
        format: str,
        anonymized: bool,
        date_from: str | None,
        date_to: str | None,
        status_filter: str,
    ) -> StreamingResponse | Response:
        import pandas as pd

        query = (
            select(Response)
            .where(Response.campaign_id == campaign_id)
            .options(selectinload(Response.answers))
        )
        if status_filter == "completed":
            query = query.where(Response.status == "completed")

        result = await db.execute(query)
        responses = result.scalars().all()

        rows = []
        for r in responses:
            row = {
                "response_id": str(r.id),
                "status": r.status,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "platform_source": r.platform_source,
            }
            for answer in r.answers:
                col = answer.question_code
                value = (
                    answer.value_text
                    or answer.value_choice
                    or (", ".join(answer.value_choices) if answer.value_choices else None)
                    or (str(answer.value_number) if answer.value_number is not None else None)
                    or (str(answer.value_matrix) if answer.value_matrix else None)
                )
                if anonymized and answer.question_type in ("email", "text") and answer.question_code.startswith("P"):
                    value = anonymize_answers(value)
                row[col] = value
            rows.append(row)

        df = pd.DataFrame(rows)

        if format == "csv":
            output = io.StringIO()
            df.to_csv(output, index=False)
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=export_{campaign_id}.csv"},
            )
        elif format == "xlsx":
            output = io.BytesIO()
            df.to_excel(output, index=False)
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename=export_{campaign_id}.xlsx"},
            )
        else:
            return Response(
                content=json.dumps(rows, default=str),
                media_type="application/json",
                headers={"Content-Disposition": f"attachment; filename=export_{campaign_id}.json"},
            )

    @staticmethod
    async def preview(db: AsyncSession, campaign_id: str) -> list[dict]:
        result = await db.execute(
            select(Response)
            .where(Response.campaign_id == campaign_id, Response.status == "completed")
            .limit(5)
            .options(selectinload(Response.answers))
        )
        responses = result.scalars().all()
        return [{"response_id": str(r.id), "answers": len(r.answers)} for r in responses]
