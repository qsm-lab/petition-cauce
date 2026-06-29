import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.models.question import Question, QuestionOption
from app.models.response import ResponseAnswer
from app.schemas.form import QuestionCreate, QuestionUpdate, QuestionOptionCreate, QuestionOptionUpdate


class QuestionService:
    @staticmethod
    async def create_question(db: AsyncSession, form_id: str, data: QuestionCreate) -> Question:
        payload = data.model_dump()
        if not payload.get("code"):
            payload["code"] = f"Q{uuid.uuid4().hex[:8].upper()}"
        question = Question(form_id=form_id, **payload)
        db.add(question)
        await db.commit()
        result = await db.execute(
            select(Question).where(Question.id == question.id).options(selectinload(Question.options))
        )
        return result.scalar_one()

    @staticmethod
    async def update_question(db: AsyncSession, question_id: str, data: QuestionUpdate) -> Question | None:
        result = await db.execute(
            select(Question).where(Question.id == question_id).options(selectinload(Question.options))
        )
        question = result.scalar_one_or_none()
        if not question:
            return None
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(question, k, v)
        await db.commit()
        result = await db.execute(
            select(Question).where(Question.id == question_id).options(selectinload(Question.options))
        )
        return result.scalar_one()

    @staticmethod
    async def delete_question(db: AsyncSession, question_id: str):
        await db.execute(delete(ResponseAnswer).where(ResponseAnswer.question_id == question_id))
        result = await db.execute(select(Question).where(Question.id == question_id))
        question = result.scalar_one_or_none()
        if question:
            await db.delete(question)
            await db.commit()

    @staticmethod
    async def reorder_questions(db: AsyncSession, form_id: str, question_ids: list[uuid.UUID]):
        for idx, qid in enumerate(question_ids):
            result = await db.execute(
                select(Question).where(Question.id == qid, Question.form_id == form_id)
            )
            question = result.scalar_one_or_none()
            if question:
                question.order_index = idx
        await db.commit()

    @staticmethod
    async def create_option(db: AsyncSession, question_id: str, data: QuestionOptionCreate) -> QuestionOption:
        option = QuestionOption(question_id=question_id, **data.model_dump())
        db.add(option)
        await db.commit()
        await db.refresh(option)
        return option

    @staticmethod
    async def update_option(db: AsyncSession, option_id: str, data: QuestionOptionUpdate) -> QuestionOption | None:
        result = await db.execute(select(QuestionOption).where(QuestionOption.id == option_id))
        option = result.scalar_one_or_none()
        if not option:
            return None
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(option, k, v)
        await db.commit()
        await db.refresh(option)
        return option

    @staticmethod
    async def delete_option(db: AsyncSession, option_id: str):
        result = await db.execute(select(QuestionOption).where(QuestionOption.id == option_id))
        option = result.scalar_one_or_none()
        if option:
            await db.delete(option)
            await db.commit()
