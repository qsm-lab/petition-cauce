from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_with_org, get_current_user
from app.schemas.form import (
    FormCreate, FormUpdate, FormResponse,
    QuestionCreate, QuestionUpdate, QuestionSchema,
    QuestionOptionCreate, QuestionOptionUpdate, QuestionOptionSchema,
    ReorderRequest, FormVersionSchema,
)
from app.services.form_service import FormService
from app.services.question_service import QuestionService
from app.models.user import User

router = APIRouter()


# ── Formularios ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[FormResponse])
async def list_forms(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    return await FormService.list_forms(db, current_user.org_id)


@router.get("/archived", response_model=list[FormResponse])
async def list_archived_forms(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    return await FormService.list_archived_forms(db, current_user.org_id)


@router.post("", response_model=FormResponse, status_code=status.HTTP_201_CREATED)
async def create_form(data: FormCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    return await FormService.create_form(db, data, current_user)


@router.get("/{form_id}", response_model=FormResponse)
async def get_form(form_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    form = await FormService.get_form(db, form_id, current_user.org_id)
    if not form:
        raise HTTPException(status_code=404, detail="Formulario no encontrado")
    return form


@router.put("/{form_id}", response_model=FormResponse)
async def update_form(form_id: str, data: FormUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    form = await FormService.update_form(db, form_id, data, current_user.org_id)
    if not form:
        raise HTTPException(status_code=404, detail="Formulario no encontrado")
    return form


@router.delete("/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_form(form_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await FormService.archive_form(db, form_id, current_user.org_id)


@router.post("/{form_id}/unarchive", response_model=FormResponse)
async def unarchive_form(form_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    form = await FormService.unarchive_form(db, form_id, current_user.org_id)
    if not form:
        raise HTTPException(status_code=404, detail="Formulario archivado no encontrado")
    return form


@router.delete("/{form_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
async def delete_form_permanently(form_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    deleted = await FormService.delete_form_permanently(db, form_id, current_user.org_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Formulario archivado no encontrado")


@router.post("/{form_id}/duplicate", response_model=FormResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_form(form_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    form = await FormService.duplicate_form(db, form_id, current_user)
    if not form:
        raise HTTPException(status_code=404, detail="Formulario no encontrado")
    return form


# ── Versiones ─────────────────────────────────────────────────────────────────

@router.get("/{form_id}/versions", response_model=list[FormVersionSchema])
async def list_versions(form_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    return await FormService.list_versions(db, form_id, current_user.org_id)


@router.post("/{form_id}/versions/{version_id}/restore", response_model=FormResponse)
async def restore_version(form_id: str, version_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    form = await FormService.restore_version(db, form_id, version_id, current_user.org_id)
    if not form:
        raise HTTPException(status_code=404, detail="Versión o formulario no encontrado")
    return form


# ── Preguntas ─────────────────────────────────────────────────────────────────

@router.post("/{form_id}/questions", response_model=QuestionSchema, status_code=status.HTTP_201_CREATED)
async def create_question(form_id: str, data: QuestionCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    return await QuestionService.create_question(db, form_id, data)


@router.post("/{form_id}/questions/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_questions(form_id: str, data: ReorderRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await QuestionService.reorder_questions(db, form_id, data.question_ids)


@router.put("/{form_id}/questions/{question_id}", response_model=QuestionSchema)
async def update_question(form_id: str, question_id: str, data: QuestionUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    question = await QuestionService.update_question(db, question_id, data)
    if not question:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    return question


@router.delete("/{form_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(form_id: str, question_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await QuestionService.delete_question(db, question_id)


# ── Opciones de pregunta ──────────────────────────────────────────────────────

@router.post("/{form_id}/questions/{question_id}/options", response_model=QuestionOptionSchema, status_code=status.HTTP_201_CREATED)
async def create_option(form_id: str, question_id: str, data: QuestionOptionCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    return await QuestionService.create_option(db, question_id, data)


@router.put("/{form_id}/questions/{question_id}/options/{option_id}", response_model=QuestionOptionSchema)
async def update_option(form_id: str, question_id: str, option_id: str, data: QuestionOptionUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    option = await QuestionService.update_option(db, option_id, data)
    if not option:
        raise HTTPException(status_code=404, detail="Opción no encontrada")
    return option


@router.delete("/{form_id}/questions/{question_id}/options/{option_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_option(form_id: str, question_id: str, option_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_with_org)):
    await QuestionService.delete_option(db, option_id)
