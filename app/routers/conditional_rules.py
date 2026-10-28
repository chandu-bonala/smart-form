from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.conditional_rule import ConditionalRule
from app.models.enums import FormStatus, UserRole
from app.models.form import Form
from app.models.question import Question
from app.models.user import User
from app.schemas.conditional_rule import (
    ConditionalRuleCreate,
    ConditionalRuleList,
    ConditionalRuleRead,
    ConditionalRuleUpdate,
)
from app.services.form_service import get_form_or_404

router = APIRouter(prefix="/conditional-rules", tags=["Conditional Rules"])


async def _ensure_form_access(form: Form, user: User) -> None:
    if user.role != UserRole.ADMIN and form.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this form")


async def _ensure_questions_belong_to_form(
    db: AsyncSession,
    form_id: str,
    trigger_field_id: str,
    target_field_id: str,
) -> None:
    if trigger_field_id == target_field_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trigger and target questions must be different",
        )

    result = await db.execute(
        select(Question.id).where(
            Question.form_id == form_id,
            Question.id.in_([trigger_field_id, target_field_id]),
        )
    )
    found_question_ids = set(result.scalars().all())
    if found_question_ids != {trigger_field_id, target_field_id}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Conditional rule questions must belong to this form",
        )


def _move_published_form_to_draft(form: Form) -> None:
    if form.status == FormStatus.PUBLISHED:
        form.status = FormStatus.DRAFT
        form.is_public = False


@router.post("", response_model=ConditionalRuleRead, status_code=status.HTTP_201_CREATED)
async def create_conditional_rule(
    payload: ConditionalRuleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConditionalRuleRead:
    form = await get_form_or_404(db, payload.form_id)
    await _ensure_form_access(form, user)
    await _ensure_questions_belong_to_form(db, form.id, payload.trigger_field_id, payload.target_field_id)

    rule = ConditionalRule(
        form_id=payload.form_id,
        trigger_field_id=payload.trigger_field_id,
        trigger_operator=payload.trigger_operator,
        trigger_value=payload.trigger_value,
        target_field_id=payload.target_field_id,
        target_action=payload.target_action,
    )
    db.add(rule)
    _move_published_form_to_draft(form)
    await db.commit()
    await db.refresh(rule)
    return ConditionalRuleRead.model_validate(rule)


@router.get("/forms/{form_id}", response_model=ConditionalRuleList)
async def list_form_rules(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConditionalRuleList:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)

    result = await db.execute(select(ConditionalRule).where(ConditionalRule.form_id == form_id))
    rules = list(result.scalars().all())
    return ConditionalRuleList(items=[ConditionalRuleRead.model_validate(r) for r in rules], total=len(rules))


@router.put("/{rule_id}", response_model=ConditionalRuleRead)
async def update_conditional_rule(
    rule_id: str,
    payload: ConditionalRuleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConditionalRuleRead:
    result = await db.execute(select(ConditionalRule).where(ConditionalRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")

    form = await get_form_or_404(db, rule.form_id)
    await _ensure_form_access(form, user)

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(rule, key, value)

    _move_published_form_to_draft(form)
    await db.commit()
    await db.refresh(rule)
    return ConditionalRuleRead.model_validate(rule)


@router.delete("/{rule_id}")
async def delete_conditional_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    result = await db.execute(select(ConditionalRule).where(ConditionalRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")

    form = await get_form_or_404(db, rule.form_id)
    await _ensure_form_access(form, user)

    await db.delete(rule)
    _move_published_form_to_draft(form)
    await db.commit()
    return {"message": "Rule deleted successfully"}
