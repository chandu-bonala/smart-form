from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.enums import UserRole
from app.models.form import Form
from app.models.question import Question
from app.models.user import User
from app.schemas.question import QuestionCreate, QuestionRead, QuestionUpdate
from app.services.form_service import create_question, delete_question, get_form_or_404, get_question_or_404, list_questions_by_form, update_question

router = APIRouter(prefix="/questions", tags=["Questions"])


async def _ensure_form_access(form: Form, user: User) -> None:
    if user.role != UserRole.ADMIN and form.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to manage this form")


@router.post("", response_model=QuestionRead, status_code=status.HTTP_201_CREATED)
async def add_question(
    payload: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuestionRead:
    form = await get_form_or_404(db, payload.form_id)
    await _ensure_form_access(form, user)
    question = await create_question(db, payload)
    return QuestionRead.model_validate(question)


@router.put("/{question_id}", response_model=QuestionRead)
async def edit_question(
    question_id: str,
    payload: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuestionRead:
    question = await get_question_or_404(db, question_id)
    form = await get_form_or_404(db, question.form_id)
    await _ensure_form_access(form, user)
    question = await update_question(db, question, payload)
    return QuestionRead.model_validate(question)


@router.delete("/{question_id}")
async def remove_question(
    question_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    question = await get_question_or_404(db, question_id)
    form = await get_form_or_404(db, question.form_id)
    await _ensure_form_access(form, user)
    await delete_question(db, question)
    return {"message": "Question deleted successfully"}


@router.get("/forms/{form_id}", response_model=list[QuestionRead])
async def get_form_questions(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[QuestionRead]:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    questions = await list_questions_by_form(db, form_id)
    return [QuestionRead.model_validate(question) for question in questions]
