import hashlib
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.campaign import Campaign
from app.models.form import Form
from app.models.response import Response, ResponseAnswer
from app.schemas.response import RespondRequest, TrackRequest


def _hash_ip(ip: str) -> str:
    return hashlib.sha256(ip.encode()).hexdigest()


async def _get_total_questions(db: AsyncSession, form_id) -> int:
    result = await db.execute(
        select(Form).where(Form.id == form_id).options(selectinload(Form.questions))
    )
    form = result.scalar_one_or_none()
    return len(form.questions) if form and form.questions else 1


class ResponseService:
    @staticmethod
    async def save_response(db: AsyncSession, campaign: Campaign, data: RespondRequest, raw_ip: str) -> Response:
        total_questions = await _get_total_questions(db, campaign.form_id)

        existing = await db.execute(select(Response).where(Response.session_token == data.session_token))
        response = existing.scalar_one_or_none()

        if response:
            response.status = data.status
            response.completed_at = datetime.now(timezone.utc)
            response.time_spent_seconds = data.time_spent_seconds
            response.completion_pct = 100 if data.status == "completed" else response.completion_pct
        else:
            response = Response(
                campaign_id=campaign.id,
                status=data.status,
                session_token=data.session_token,
                device_fingerprint=data.device_fingerprint,
                ip_hash=_hash_ip(raw_ip),
                platform_source=data.platform_source,
                total_questions=total_questions,
                completion_pct=100 if data.status == "completed" else 0,
                time_spent_seconds=data.time_spent_seconds,
            )
            db.add(response)
            await db.flush()

        for answer_data in data.answers:
            answer = ResponseAnswer(
                response_id=response.id,
                question_id=answer_data.question_id,
                question_code=answer_data.question_code,
                question_type=answer_data.question_type,
                value_text=answer_data.value_text,
                value_number=answer_data.value_number,
                value_choice=answer_data.value_choice,
                value_choices=answer_data.value_choices,
                value_matrix=answer_data.value_matrix,
                time_on_question_seconds=answer_data.time_on_question_seconds,
            )
            db.add(answer)

        await db.commit()
        await db.refresh(response)
        return response

    @staticmethod
    async def track_event(db: AsyncSession, campaign: Campaign, data: TrackRequest):
        existing = await db.execute(select(Response).where(Response.session_token == data.session_token))
        response = existing.scalar_one_or_none()

        if not response:
            total_questions = await _get_total_questions(db, campaign.form_id)
            response = Response(
                campaign_id=campaign.id,
                status="started" if data.event_type == "open" else "abandoned",
                session_token=data.session_token,
                device_fingerprint=data.device_fingerprint,
                total_questions=total_questions,
                current_question_idx=data.question_index,
            )
            db.add(response)
        else:
            response.current_question_idx = data.question_index
            if data.event_type == "abandon":
                response.status = "abandoned"

        await db.commit()
