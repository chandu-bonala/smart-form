from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.enums import FormStatus, UserRole
from app.models.form import Form
from app.models.question import Question
from app.models.question_branch import QuestionBranch
from app.models.user import User
from app.schemas.question_branch import QuestionBranchCreate, QuestionBranchRead, QuestionBranchUpdate
from app.services.form_service import get_form_or_404, get_question_or_404, list_branches_by_form

router = APIRouter(prefix="/question-branches", tags=["Question Branches"])


async def _ensure_form_access(form: Form, user: User) -> None:
    if user.role != UserRole.ADMIN and form.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this form")


def _move_published_form_to_draft(form: Form) -> None:
    if form.status == FormStatus.PUBLISHED:
        form.status = FormStatus.DRAFT
        form.is_public = False


async def _validate_trigger_option(question: Question, trigger_option_text: str) -> None:
    normalized = trigger_option_text.strip().lower()
    if question.question_type.value == "yes_no" and not question.options:
        if normalized not in {"yes", "no"}:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Trigger option does not belong to this question")
        return

    valid_option_texts = {option.option_text.strip().lower() for option in question.options}
    if normalized not in valid_option_texts:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Trigger option does not belong to this question")


async def _ensure_unique_branch_option(
    db: AsyncSession,
    form_id: str,
    trigger_question_id: str,
    trigger_option_text: str,
    branch_id: str | None = None,
) -> None:
    statement = select(QuestionBranch.id).where(
        QuestionBranch.form_id == form_id,
        QuestionBranch.trigger_question_id == trigger_question_id,
        func.lower(QuestionBranch.trigger_option_text) == trigger_option_text.strip().lower(),
    )
    if branch_id is not None:
        statement = statement.where(QuestionBranch.id != branch_id)

    result = await db.execute(statement.limit(1))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This option already has a branch. Open it instead of creating another one.",
        )


@router.post("", response_model=QuestionBranchRead, status_code=status.HTTP_201_CREATED)
async def create_question_branch(
    payload: QuestionBranchCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuestionBranchRead:
    form = await get_form_or_404(db, payload.form_id)
    await _ensure_form_access(form, user)

    trigger_question = await get_question_or_404(db, payload.trigger_question_id)
    if trigger_question.form_id != form.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Trigger question must belong to this form")

    await _validate_trigger_option(trigger_question, payload.trigger_option_text)
    await _ensure_unique_branch_option(db, form.id, payload.trigger_question_id, payload.trigger_option_text)

    branch = QuestionBranch(
        form_id=payload.form_id,
        trigger_question_id=payload.trigger_question_id,
        trigger_option_text=payload.trigger_option_text.strip(),
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        order_index=payload.order_index,
    )
    db.add(branch)
    _move_published_form_to_draft(form)
    await db.commit()
    await db.refresh(branch)
    return QuestionBranchRead.model_validate(branch)


@router.get("/forms/{form_id}", response_model=list[QuestionBranchRead])
async def list_form_branches(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[QuestionBranchRead]:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    branches = await list_branches_by_form(db, form_id)
    return [QuestionBranchRead.model_validate(branch) for branch in branches]


@router.get("/{branch_id}", response_model=QuestionBranchRead)
async def get_question_branch(
    branch_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuestionBranchRead:
    result = await db.execute(select(QuestionBranch).where(QuestionBranch.id == branch_id))
    branch = result.scalar_one_or_none()
    if branch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    form = await get_form_or_404(db, branch.form_id)
    await _ensure_form_access(form, user)
    return QuestionBranchRead.model_validate(branch)


@router.put("/{branch_id}", response_model=QuestionBranchRead)
async def update_question_branch(
    branch_id: str,
    payload: QuestionBranchUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuestionBranchRead:
    result = await db.execute(select(QuestionBranch).where(QuestionBranch.id == branch_id))
    branch = result.scalar_one_or_none()
    if branch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    form = await get_form_or_404(db, branch.form_id)
    await _ensure_form_access(form, user)

    updates = payload.model_dump(exclude_unset=True)
    next_trigger_question_id = branch.trigger_question_id
    next_trigger_option_text = branch.trigger_option_text
    for key, value in updates.items():
        if isinstance(value, str):
            setattr(branch, key, value.strip() or value)
        else:
            setattr(branch, key, value)
        if key == "trigger_option_text" and isinstance(value, str):
            next_trigger_option_text = value.strip()
        if key == "trigger_question_id" and isinstance(value, str):
            next_trigger_question_id = value

    await _ensure_unique_branch_option(db, form.id, next_trigger_question_id, next_trigger_option_text, branch.id)

    _move_published_form_to_draft(form)
    await db.commit()
    await db.refresh(branch)
    return QuestionBranchRead.model_validate(branch)


@router.delete("/{branch_id}")
async def delete_question_branch(
    branch_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    result = await db.execute(select(QuestionBranch).where(QuestionBranch.id == branch_id))
    branch = result.scalar_one_or_none()
    if branch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")

    form = await get_form_or_404(db, branch.form_id)
    await _ensure_form_access(form, user)

    await db.delete(branch)
    _move_published_form_to_draft(form)
    await db.commit()
    return {"message": "Branch deleted successfully"}
