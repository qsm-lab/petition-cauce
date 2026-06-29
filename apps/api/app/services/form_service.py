import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.question import Question, QuestionOption
from app.models.user import User
from app.schemas.form import FormCreate, FormUpdate

MAX_VERSIONS = 20


def _build_snapshot(form: Form) -> dict:
    return {
        "title": form.title,
        "description": form.description,
        "status": form.status,
        "privacy_notice_text": form.privacy_notice_text,
        "requires_explicit_consent": form.requires_explicit_consent,
        "consent_text": form.consent_text,
        "consent_version": form.consent_version,
        "meta": dict(form.meta or {}),
        "questions": [
            {
                "id": str(q.id),
                "code": q.code,
                "type": q.type,
                "label": q.label,
                "description": q.description,
                "is_required": q.is_required,
                "is_pii": q.is_pii,
                "order_index": q.order_index,
                "validation": dict(q.validation or {}),
                "conditional_logic": q.conditional_logic,
                "meta": dict(q.meta or {}),
                "options": [
                    {
                        "id": str(o.id),
                        "label": o.label,
                        "value": o.value,
                        "order_index": o.order_index,
                        "meta": dict(o.meta or {}),
                    }
                    for o in q.options
                ],
            }
            for q in sorted(form.questions, key=lambda x: x.order_index)
        ],
    }


async def _save_version(db: AsyncSession, form: Form) -> None:
    count_result = await db.execute(
        select(func.count(FormVersion.id)).where(FormVersion.form_id == form.id)
    )
    count = count_result.scalar_one()

    next_number = count + 1
    now = datetime.now(timezone.utc)
    label = now.strftime("%d %b %Y %H:%M")

    version = FormVersion(
        form_id=form.id,
        version_number=next_number,
        label=label,
        snapshot=_build_snapshot(form),
    )
    db.add(version)

    if count >= MAX_VERSIONS:
        oldest = await db.execute(
            select(FormVersion)
            .where(FormVersion.form_id == form.id)
            .order_by(FormVersion.version_number.asc())
            .limit(count - MAX_VERSIONS + 1)
        )
        for old in oldest.scalars().all():
            await db.delete(old)


class FormService:
    @staticmethod
    async def list_forms(db: AsyncSession, org_id: uuid.UUID) -> list[Form]:
        result = await db.execute(
            select(Form)
            .where(Form.org_id == org_id, Form.status != "archived")
            .options(selectinload(Form.questions).selectinload(Question.options))
            .order_by(Form.created_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def get_form(db: AsyncSession, form_id: str, org_id: uuid.UUID) -> Form | None:
        result = await db.execute(
            select(Form)
            .where(Form.id == form_id, Form.org_id == org_id)
            .options(selectinload(Form.questions).selectinload(Question.options))
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_form(db: AsyncSession, data: FormCreate, user: User) -> Form:
        form = Form(
            org_id=user.org_id,
            created_by=user.id,
            **data.model_dump(),
        )
        db.add(form)
        await db.commit()
        result = await db.execute(
            select(Form)
            .where(Form.id == form.id)
            .options(selectinload(Form.questions).selectinload(Question.options))
        )
        return result.scalar_one()

    @staticmethod
    async def update_form(db: AsyncSession, form_id: str, data: FormUpdate, org_id: uuid.UUID) -> Form | None:
        result = await db.execute(
            select(Form)
            .where(Form.id == form_id, Form.org_id == org_id)
            .options(selectinload(Form.questions).selectinload(Question.options))
        )
        form = result.scalar_one_or_none()
        if not form:
            return None
        payload = data.model_dump(exclude_none=True)
        meta_fields = {"description_font_size", "cover_image_url", "og_description", "og_image_alt"}
        meta_updates = {k: payload.pop(k) for k in list(payload) if k in meta_fields}
        for k, v in payload.items():
            setattr(form, k, v)
        if meta_updates:
            meta = dict(form.meta or {})
            meta.update(meta_updates)
            form.meta = meta
        await _save_version(db, form)
        await db.commit()
        await db.refresh(form)
        return form

    @staticmethod
    async def duplicate_form(db: AsyncSession, form_id: str, user: User) -> Form | None:
        result = await db.execute(
            select(Form)
            .where(Form.id == form_id, Form.org_id == user.org_id)
            .options(selectinload(Form.questions).selectinload(Question.options))
        )
        original = result.scalar_one_or_none()
        if not original:
            return None

        new_form = Form(
            org_id=user.org_id,
            created_by=user.id,
            title=f"{original.title} (copia)",
            description=original.description,
            privacy_notice_text=original.privacy_notice_text,
            requires_explicit_consent=original.requires_explicit_consent,
            consent_text=original.consent_text,
            consent_version=original.consent_version,
            meta=dict(original.meta or {}),
        )
        db.add(new_form)
        await db.flush()

        for q in sorted(original.questions, key=lambda x: x.order_index):
            new_q = Question(
                form_id=new_form.id,
                code=q.code,
                type=q.type,
                label=q.label,
                description=q.description,
                is_required=q.is_required,
                is_pii=q.is_pii,
                order_index=q.order_index,
                validation=dict(q.validation or {}),
                conditional_logic=q.conditional_logic,
                meta=dict(q.meta or {}),
            )
            db.add(new_q)
            await db.flush()
            for opt in q.options:
                db.add(QuestionOption(
                    question_id=new_q.id,
                    label=opt.label,
                    value=opt.value,
                    order_index=opt.order_index,
                    meta=dict(opt.meta or {}),
                ))

        await db.commit()
        result = await db.execute(
            select(Form)
            .where(Form.id == new_form.id)
            .options(selectinload(Form.questions).selectinload(Question.options))
        )
        return result.scalar_one()

    @staticmethod
    async def list_archived_forms(db: AsyncSession, org_id: uuid.UUID) -> list[Form]:
        result = await db.execute(
            select(Form)
            .where(Form.org_id == org_id, Form.status == "archived")
            .options(selectinload(Form.questions).selectinload(Question.options))
            .order_by(Form.updated_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def archive_form(db: AsyncSession, form_id: str, org_id: uuid.UUID):
        result = await db.execute(select(Form).where(Form.id == form_id, Form.org_id == org_id))
        form = result.scalar_one_or_none()
        if form:
            form.status = "archived"
            await db.commit()

    @staticmethod
    async def unarchive_form(db: AsyncSession, form_id: str, org_id: uuid.UUID) -> Form | None:
        result = await db.execute(
            select(Form)
            .where(Form.id == form_id, Form.org_id == org_id, Form.status == "archived")
            .options(selectinload(Form.questions).selectinload(Question.options))
        )
        form = result.scalar_one_or_none()
        if not form:
            return None
        form.status = "draft"
        await db.commit()
        await db.refresh(form)
        return form

    @staticmethod
    async def delete_form_permanently(db: AsyncSession, form_id: str, org_id: uuid.UUID) -> bool:
        result = await db.execute(
            select(Form).where(Form.id == form_id, Form.org_id == org_id, Form.status == "archived")
        )
        form = result.scalar_one_or_none()
        if not form:
            return False
        await db.delete(form)
        await db.commit()
        return True

    @staticmethod
    async def list_versions(db: AsyncSession, form_id: str, org_id: uuid.UUID) -> list[FormVersion]:
        form_result = await db.execute(select(Form).where(Form.id == form_id, Form.org_id == org_id))
        if not form_result.scalar_one_or_none():
            return []
        result = await db.execute(
            select(FormVersion)
            .where(FormVersion.form_id == form_id)
            .order_by(FormVersion.version_number.desc())
            .limit(MAX_VERSIONS)
        )
        return result.scalars().all()

    @staticmethod
    async def restore_version(db: AsyncSession, form_id: str, version_id: str, org_id: uuid.UUID) -> Form | None:
        form_result = await db.execute(
            select(Form)
            .where(Form.id == form_id, Form.org_id == org_id)
            .options(selectinload(Form.questions).selectinload(Question.options))
        )
        form = form_result.scalar_one_or_none()
        if not form:
            return None

        ver_result = await db.execute(
            select(FormVersion).where(FormVersion.id == version_id, FormVersion.form_id == form_id)
        )
        version = ver_result.scalar_one_or_none()
        if not version:
            return None

        snap = version.snapshot

        # Guardar versión actual antes de restaurar
        await _save_version(db, form)

        # Actualizar campos del formulario desde el snapshot
        form.title = snap.get("title", form.title)
        form.description = snap.get("description")
        form.privacy_notice_text = snap.get("privacy_notice_text")
        form.requires_explicit_consent = snap.get("requires_explicit_consent", False)
        form.consent_text = snap.get("consent_text")
        form.consent_version = snap.get("consent_version")
        form.meta = snap.get("meta", {})

        # Eliminar preguntas actuales y recrear desde snapshot
        for q in list(form.questions):
            await db.delete(q)
        await db.flush()

        for q_snap in snap.get("questions", []):
            new_q = Question(
                form_id=form.id,
                code=q_snap["code"],
                type=q_snap["type"],
                label=q_snap["label"],
                description=q_snap.get("description"),
                is_required=q_snap.get("is_required", False),
                is_pii=q_snap.get("is_pii", False),
                order_index=q_snap.get("order_index", 0),
                validation=q_snap.get("validation", {}),
                conditional_logic=q_snap.get("conditional_logic"),
                meta=q_snap.get("meta", {}),
            )
            db.add(new_q)
            await db.flush()
            for o_snap in q_snap.get("options", []):
                db.add(QuestionOption(
                    question_id=new_q.id,
                    label=o_snap["label"],
                    value=o_snap["value"],
                    order_index=o_snap.get("order_index", 0),
                    meta=o_snap.get("meta", {}),
                ))

        await db.commit()
        result = await db.execute(
            select(Form)
            .where(Form.id == form.id)
            .options(selectinload(Form.questions).selectinload(Question.options))
        )
        return result.scalar_one()
