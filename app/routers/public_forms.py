from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.enums import FormStatus
from app.models.question import Question
from app.models.response import Response
from app.schemas.response import ResponseCreate, ResponseList, ResponseRead
from app.services.conditional_logic_service import ConditionalLogicEngine
from app.services.field_validator_service import FieldValidator
from app.services.form_service import create_response

router = APIRouter(prefix="/public", tags=["Public Forms"])


@router.get("/forms/{slug}")
async def get_public_form(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a public form by slug (no authentication required)."""
    from app.models.form import Form
    result = await db.execute(
        select(Form)
        .options(
            selectinload(Form.questions).selectinload(Question.options),
            selectinload(Form.branches),
            selectinload(Form.conditional_rules),
        )
        .where(
            Form.form_slug == slug,
            Form.status == FormStatus.PUBLISHED,
            Form.is_public.is_(True),
            Form.is_hidden.is_(False),
        )
    )
    form = result.scalar_one_or_none()
    
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found or not public")
    
    from app.schemas.form import FormRead
    return FormRead.model_validate(form)


@router.post("/forms/{slug}/submit")
async def submit_public_form(
    slug: str,
    payload: ResponseCreate,
    db: AsyncSession = Depends(get_db),
) -> ResponseRead:
    """Submit a public form (no authentication required)."""
    from app.models.form import Form
    from app.models.question import Question as QuestionModel
    
    result = await db.execute(
        select(Form)
        .options(
            selectinload(Form.questions).selectinload(QuestionModel.options),
            selectinload(Form.branches),
            selectinload(Form.conditional_rules),
        )
        .where(
            Form.form_slug == slug,
            Form.status == FormStatus.PUBLISHED,
            Form.is_public.is_(True),
            Form.is_hidden.is_(False),
        )
    )
    form = result.scalar_one_or_none()
    
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found or not public")

    if payload.form_id != form.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Response does not belong to this form")

    if form.collect_email:
        email = (payload.respondent_email or "").strip()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A valid respondent email is required")
        payload.respondent_email = email
    
    # Check multiple response allowance
    if not form.allow_multiple_responses:
        existing_query = select(Response).where(Response.form_id == form.id)
        if payload.respondent_email:
            existing_query = existing_query.where(Response.respondent_email == payload.respondent_email)
        existing_responses = await db.execute(existing_query)
        if existing_responses.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This form does not allow multiple responses",
            )
    
    # Build answers dict for validation
    answers_dict = {a.question_id: a.answer for a in payload.answers}
    all_field_ids = {q.id for q in form.questions}

    # Validate conditional rules
    rules = await ConditionalLogicEngine.get_form_rules(db, form.id)
    branch_visible_questions = ConditionalLogicEngine.get_branch_visible_questions(form, answers_dict)
    required_fields = {q.id for q in form.questions if q.required and q.id in branch_visible_questions}

    is_valid, error = ConditionalLogicEngine.validate_submission(
        rules,
        answers_dict,
        required_fields,
        all_field_ids,
    )
    
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error)

    is_valid, error = ConditionalLogicEngine.validate_branch_submission(form, answers_dict)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=error)
    
    # Validate fields
    for answer_payload in payload.answers:
        question_result = await db.execute(
            select(QuestionModel).options(selectinload(QuestionModel.options)).where(QuestionModel.id == answer_payload.question_id)
        )
        question = question_result.scalar_one_or_none()
        
        if question:
            options = [o.option_text for o in question.options]
            is_valid, error = FieldValidator.validate_field(
                question.question_type,
                answer_payload.answer,
                question.validation,
                options,
            )
            
            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Question '{question.title}': {error}",
                )
    
    # Create response
    response = await create_response(db, payload)
    return ResponseRead.model_validate(response)
