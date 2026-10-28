from __future__ import annotations

from collections.abc import Iterable
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.answer import Answer
from app.models.enums import FormStatus, QuestionType
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.option import Option
from app.models.question import Question
from app.models.question_branch import QuestionBranch
from app.models.response import Response
from app.models.upload import Upload
from app.schemas.form import FormCreate, FormUpdate
from app.schemas.question import QuestionCreate, QuestionUpdate
from app.schemas.response import ResponseCreate
from app.services.qr_service import build_form_qr_payload
from app.utils.helpers import slugify


async def get_form_or_404(db: AsyncSession, form_id: str) -> Form:
    result = await db.execute(
        select(Form)
        .options(
            selectinload(Form.questions).selectinload(Question.options),
            selectinload(Form.branches),
            selectinload(Form.responses),
            selectinload(Form.conditional_rules),
        )
        .where(Form.id == form_id)
    )
    form = result.scalar_one_or_none()
    if form is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form not found")
    return form


async def get_question_or_404(db: AsyncSession, question_id: str) -> Question:
    result = await db.execute(
        select(Question)
        .options(selectinload(Question.options), selectinload(Question.form))
        .where(Question.id == question_id)
    )
    question = result.scalar_one_or_none()
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return question


async def create_form(db: AsyncSession, payload: FormCreate) -> Form:
    slug = slugify(payload.form_slug or payload.title)
    result = await db.execute(select(Form).where(Form.form_slug == slug))
    suffix = 1
    while result.scalar_one_or_none() is not None:
        slug = f"{slugify(payload.title)}-{suffix}"
        suffix += 1
        result = await db.execute(select(Form).where(Form.form_slug == slug))

    form = Form(
        owner_id=payload.owner_id,
        title=payload.title,
        description=payload.description,
        theme=payload.theme,
        status=payload.status,
        is_public=payload.is_public,
        is_hidden=payload.is_hidden,
        allow_multiple_responses=payload.allow_multiple_responses,
        collect_email=payload.collect_email,
        start_date=payload.start_date,
        end_date=payload.end_date,
        form_slug=slug,
        qr_code=payload.qr_code or build_form_qr_payload(slug),
    )
    db.add(form)
    await db.commit()
    await db.refresh(form)

    result = await db.execute(
        select(Form)
        .options(
            selectinload(Form.questions).selectinload(Question.options),
            selectinload(Form.branches),
            selectinload(Form.conditional_rules),
        )
        .where(Form.id == form.id)
    )
    form = result.scalar_one()
    return form


async def list_forms(db: AsyncSession, owner_id: str | None = None) -> list[Form]:
    statement = select(Form).options(
        selectinload(Form.questions).selectinload(Question.options),
        selectinload(Form.branches),
        selectinload(Form.conditional_rules),
    )
    if owner_id:
        statement = statement.where(Form.owner_id == owner_id)
    result = await db.execute(statement.order_by(Form.created_at.desc()))
    return list(result.scalars().unique().all())


async def form_has_versions(db: AsyncSession, form_id: str) -> bool:
    result = await db.execute(select(FormVersion.id).where(FormVersion.form_id == form_id).limit(1))
    return result.scalar_one_or_none() is not None


async def update_form(db: AsyncSession, form: Form, payload: FormUpdate) -> Form:
    updates = payload.model_dump(exclude_unset=True)
    has_versions = await form_has_versions(db, form.id)

    if updates.get("status") == FormStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Use the publish endpoint to publish forms")

    if has_versions and "form_slug" in updates:
        requested_slug = slugify(updates["form_slug"]) if updates["form_slug"] else form.form_slug
        if requested_slug != form.form_slug:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Public URL cannot change after the form has been published",
            )
        updates.pop("form_slug")

    if not has_versions and "form_slug" not in updates and "title" in updates:
        updates["form_slug"] = slugify(updates["title"])
    if "form_slug" in updates and updates["form_slug"]:
        updates["form_slug"] = slugify(updates["form_slug"])
        result = await db.execute(select(Form).where(Form.form_slug == updates["form_slug"], Form.id != form.id))
        if result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Form slug already exists")

    should_revert_to_draft = (
        form.status == FormStatus.PUBLISHED
        and any(key != "status" for key in updates.keys())
        and ("status" not in updates or updates["status"] != FormStatus.PUBLISHED)
    )

    for key, value in updates.items():
        setattr(form, key, value)

    if form.status == FormStatus.ARCHIVED:
        form.is_public = False
        form.is_hidden = True

    if should_revert_to_draft:
        form.status = FormStatus.DRAFT
        form.is_public = False

    await db.commit()
    await db.refresh(form)
    await db.refresh(form, attribute_names=["questions"])
    return form


async def delete_form(db: AsyncSession, form: Form) -> None:
    await db.delete(form)
    await db.commit()


async def publish_form(db: AsyncSession, form: Form, publish: bool = True) -> Form:
    form.status = FormStatus.PUBLISHED if publish else FormStatus.DRAFT
    if publish:
        form.is_public = True
    await db.commit()
    await db.refresh(form)
    await db.refresh(form, attribute_names=["questions"])
    return form


async def archive_form(db: AsyncSession, form: Form) -> Form:
    form.status = FormStatus.ARCHIVED
    form.is_public = False
    form.is_hidden = True
    await db.commit()
    await db.refresh(form)
    await db.refresh(form, attribute_names=["questions"])
    return form


async def restore_archived_form(db: AsyncSession, form: Form) -> Form:
    if form.status != FormStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Form is not archived")
    form.status = FormStatus.DRAFT
    form.is_public = False
    form.is_hidden = False
    await db.commit()
    await db.refresh(form)
    await db.refresh(form, attribute_names=["questions"])
    return form


async def create_question(db: AsyncSession, payload: QuestionCreate) -> Question:
    form = await get_form_or_404(db, payload.form_id)
    if payload.branch_id is not None:
        result = await db.execute(
            select(QuestionBranch).where(
                QuestionBranch.id == payload.branch_id,
                QuestionBranch.form_id == form.id,
            )
        )
        branch = result.scalar_one_or_none()
        if branch is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Branch does not belong to this form")
    question = Question(
        form_id=payload.form_id,
        branch_id=payload.branch_id,
        title=payload.title,
        question_type=payload.question_type,
        placeholder=payload.placeholder,
        required=payload.required,
        order_index=payload.order_index,
        validation=payload.validation,
    )
    for option_payload in payload.options:
        question.options.append(
            Option(option_text=option_payload.option_text, order_index=option_payload.order_index)
        )
    db.add(question)

    if form.status == FormStatus.PUBLISHED:
        form.status = FormStatus.DRAFT
        form.is_public = False

    await db.commit()
    await db.refresh(question)
    await db.refresh(question, attribute_names=["options"])
    return question


async def update_question(db: AsyncSession, question: Question, payload: QuestionUpdate) -> Question:
    updates = payload.model_dump(exclude_unset=True, exclude={"options"})
    if "branch_id" in updates and updates["branch_id"] is not None:
        result = await db.execute(
            select(QuestionBranch).where(
                QuestionBranch.id == updates["branch_id"],
                QuestionBranch.form_id == question.form_id,
            )
        )
        branch = result.scalar_one_or_none()
        if branch is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Branch does not belong to this form")
    for key, value in updates.items():
        setattr(question, key, value)
    if payload.options is not None:
        question.options.clear()
        for option_payload in payload.options:
            question.options.append(
                Option(option_text=option_payload.option_text, order_index=option_payload.order_index)
            )

    if question.form is not None and question.form.status == FormStatus.PUBLISHED:
        question.form.status = FormStatus.DRAFT
        question.form.is_public = False

    await db.commit()
    await db.refresh(question)
    await db.refresh(question, attribute_names=["options"])
    return question


async def delete_question(db: AsyncSession, question: Question) -> None:
    if question.form is not None and question.form.status == FormStatus.PUBLISHED:
        question.form.status = FormStatus.DRAFT
        question.form.is_public = False
    await db.delete(question)
    await db.commit()


async def list_questions_by_form(db: AsyncSession, form_id: str) -> list[Question]:
    await get_form_or_404(db, form_id)
    result = await db.execute(
        select(Question)
        .options(selectinload(Question.options))
        .where(Question.form_id == form_id)
        .order_by(Question.order_index.asc())
    )
    return list(result.scalars().unique().all())


async def list_branches_by_form(db: AsyncSession, form_id: str) -> list[QuestionBranch]:
    await get_form_or_404(db, form_id)
    result = await db.execute(
        select(QuestionBranch)
        .where(QuestionBranch.form_id == form_id)
        .order_by(QuestionBranch.order_index.asc())
    )
    return list(result.scalars().unique().all())


async def create_response(db: AsyncSession, payload: ResponseCreate) -> Response:
    form = await get_form_or_404(db, payload.form_id)
    if form.status == FormStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Archived forms do not accept responses")

    latest_version = await get_latest_published_form_version(db, form.id)
    if form.status == FormStatus.PUBLISHED and latest_version is None:
        latest_version = await create_form_version(db, form)

    questions_by_id = {question.id: question for question in form.questions}
    valid_question_ids = set(questions_by_id)
    response = Response(
        form_id=payload.form_id,
        form_version_id=latest_version.id if latest_version is not None else None,
        form_version_number=latest_version.version_number if latest_version is not None else None,
        submitted_by=payload.submitted_by,
        respondent_email=payload.respondent_email,
        completion_time=payload.completion_time,
        ip_address=payload.ip_address,
        device=payload.device,
        browser=payload.browser,
    )
    for answer_payload in payload.answers:
        if answer_payload.question_id not in valid_question_ids:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Answer question does not belong to this form")
        question = questions_by_id.get(answer_payload.question_id)
        response.answers.append(
            Answer(
                question_id=answer_payload.question_id,
                question_snapshot=build_question_snapshot(question) if question is not None else None,
                answer=answer_payload.answer,
                file_path=answer_payload.file_path,
            )
        )
    db.add(response)
    await db.commit()
    await db.refresh(response)
    await db.refresh(response, attribute_names=["answers"])
    return response


async def get_response_or_404(db: AsyncSession, response_id: str) -> Response:
    result = await db.execute(select(Response).options(selectinload(Response.answers)).where(Response.id == response_id))
    response = result.scalar_one_or_none()
    if response is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Response not found")
    return response


async def list_responses_by_form(db: AsyncSession, form_id: str) -> list[Response]:
    await get_form_or_404(db, form_id)
    result = await db.execute(
        select(Response)
        .options(selectinload(Response.answers))
        .where(Response.form_id == form_id)
        .order_by(Response.submitted_at.desc())
    )
    return list(result.scalars().unique().all())


async def delete_response(db: AsyncSession, response: Response) -> None:
    await db.delete(response)
    await db.commit()


async def list_uploads_by_answer_ids(db: AsyncSession, answer_ids: Iterable[str]) -> list[Upload]:
    result = await db.execute(select(Upload).where(Upload.answer_id.in_(list(answer_ids))))
    return list(result.scalars().all())


# ============= FORM VERSIONING =============

def build_question_snapshot(question: Question) -> dict:
    return {
        "id": question.id,
        "branch_id": question.branch_id,
        "title": question.title,
        "type": question.question_type.value,
        "placeholder": question.placeholder,
        "required": question.required,
        "order_index": question.order_index,
        "validation": question.validation,
        "options": [
            {
                "id": option.id,
                "text": option.option_text,
                "order": option.order_index,
            }
            for option in question.options
        ],
    }


def build_form_schema_snapshot(form: Form) -> dict:
    return {
        "form_id": form.id,
        "form_title": form.title,
        "form_description": form.description,
        "form_slug": form.form_slug,
        "theme": form.theme,
        "settings": {
            "allow_multiple_responses": form.allow_multiple_responses,
            "collect_email": form.collect_email,
            "start_date": form.start_date.isoformat() if form.start_date else None,
            "end_date": form.end_date.isoformat() if form.end_date else None,
        },
        "questions": [build_question_snapshot(question) for question in form.questions],
        "branches": [
            {
                "id": branch.id,
                "form_id": branch.form_id,
                "trigger_question_id": branch.trigger_question_id,
                "trigger_option_text": branch.trigger_option_text,
                "title": branch.title,
                "description": branch.description,
                "order_index": branch.order_index,
            }
            for branch in form.branches
        ],
        "conditional_rules": [
            {
                "id": rule.id,
                "trigger_field_id": rule.trigger_field_id,
                "trigger_operator": rule.trigger_operator,
                "trigger_value": rule.trigger_value,
                "target_field_id": rule.target_field_id,
                "target_action": rule.target_action,
            }
            for rule in form.conditional_rules
        ],
    }


async def get_latest_published_form_version(db: AsyncSession, form_id: str) -> FormVersion | None:
    result = await db.execute(
        select(FormVersion)
        .where(FormVersion.form_id == form_id, FormVersion.is_published.is_(True))
        .order_by(FormVersion.version_number.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def create_form_version(db: AsyncSession, form: Form, version_number: int | None = None) -> FormVersion:
    """Create a frozen snapshot of form schema for versioning."""
    schema_snapshot = build_form_schema_snapshot(form)

    if version_number is None:
        result = await db.execute(select(func.max(FormVersion.version_number)).where(FormVersion.form_id == form.id))
        version_number = (result.scalar() or 0) + 1
    
    version = FormVersion(
        form_id=form.id,
        version_number=version_number,
        schema_snapshot=schema_snapshot,
        is_published=True,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return version


async def publish_form_with_version(db: AsyncSession, form: Form) -> tuple[Form, FormVersion]:
    form = await publish_form(db, form, publish=True)
    current_snapshot = build_form_schema_snapshot(form)
    latest_version = await get_latest_published_form_version(db, form.id)

    if latest_version is not None and latest_version.schema_snapshot == current_snapshot:
        return form, latest_version

    version = await create_form_version(db, form)
    return form, version


async def duplicate_form(db: AsyncSession, form: Form, owner_id: str) -> Form:
    """Create a copy of a form as a draft."""
    # Create new form
    new_slug = slugify(f"{form.title}-copy")
    suffix = 1
    while True:
        result = await db.execute(select(Form).where(Form.form_slug == new_slug))
        if result.scalar_one_or_none() is None:
            break
        new_slug = f"{slugify(form.title)}-copy-{suffix}"
        suffix += 1
    
    new_form = Form(
        owner_id=owner_id,
        title=f"{form.title} (Copy)",
        description=form.description,
        theme=form.theme,
        status=FormStatus.DRAFT,
        is_public=False,
        is_hidden=False,
        allow_multiple_responses=form.allow_multiple_responses,
        collect_email=form.collect_email,
        form_slug=new_slug,
        qr_code=build_form_qr_payload(new_slug),
    )
    db.add(new_form)
    await db.flush()

    branch_id_map: dict[str, str] = {}

    for branch in form.branches:
        new_branch = QuestionBranch(
            form_id=new_form.id,
            trigger_question_id=branch.trigger_question_id,
            trigger_option_text=branch.trigger_option_text,
            title=branch.title,
            description=branch.description,
            order_index=branch.order_index,
        )
        db.add(new_branch)
        await db.flush()
        branch_id_map[branch.id] = new_branch.id
    
    # Copy questions
    for question in form.questions:
        new_question = Question(
            form_id=new_form.id,
            branch_id=branch_id_map.get(question.branch_id) if question.branch_id else None,
            title=question.title,
            question_type=question.question_type,
            placeholder=question.placeholder,
            required=question.required,
            order_index=question.order_index,
            validation=question.validation,
        )
        for option in question.options:
            new_question.options.append(
                Option(option_text=option.option_text, order_index=option.order_index)
            )
        db.add(new_question)
    
    await db.commit()
    await db.refresh(new_form)
    await db.refresh(new_form, attribute_names=["questions", "branches"])
    return new_form


# ============= RESPONSE FILTERING & SEARCH =============

async def list_responses_paginated(
    db: AsyncSession,
    form_id: str,
    page: int = 1,
    page_size: int = 20,
    start_date: date | None = None,
    end_date: date | None = None,
    search_query: str | None = None,
) -> tuple[list[Response], int]:
    """List responses with pagination and filtering."""
    await get_form_or_404(db, form_id)
    
    query = select(Response).where(Response.form_id == form_id)
    count_query = select(func.count(func.distinct(Response.id))).where(Response.form_id == form_id)
    
    # Date range filter
    if start_date:
        from datetime import datetime as dt
        start_datetime = dt.combine(start_date, dt.min.time())
        query = query.where(Response.submitted_at >= start_datetime)
        count_query = count_query.where(Response.submitted_at >= start_datetime)
    if end_date:
        from datetime import datetime as dt
        end_datetime = dt.combine(end_date, dt.max.time())
        query = query.where(Response.submitted_at <= end_datetime)
        count_query = count_query.where(Response.submitted_at <= end_datetime)
    
    if search_query:
        search_pattern = f"%{search_query.strip()}%"
        query = query.join(Answer).where(Answer.answer.ilike(search_pattern))
        count_query = count_query.join(Answer).where(Answer.answer.ilike(search_pattern))
    
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.distinct().order_by(Response.submitted_at.desc()).offset(offset).limit(page_size)
    
    result = await db.execute(query.options(selectinload(Response.answers)))
    responses = list(result.scalars().unique().all())
    
    return responses, total


async def get_form_by_slug(db: AsyncSession, slug: str) -> Form | None:
    """Get a form by its slug (for public access)."""
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
    return result.scalar_one_or_none()


async def list_responses_by_form_version(db: AsyncSession, form_id: str, version_number: int) -> tuple[list[Response], int]:
    """List responses that belong to a specific published form version.

    New responses are linked directly to their published version. Older rows without
    a stored version are attributed by submitted_at as a compatibility fallback.
    """
    result = await db.execute(select(FormVersion).where(FormVersion.form_id == form_id, FormVersion.version_number == version_number))
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Form version not found")

    # find next version (if any)
    result = await db.execute(
        select(FormVersion).where(FormVersion.form_id == form_id, FormVersion.version_number > version_number).order_by(FormVersion.version_number.asc()).limit(1)
    )
    next_version = result.scalar_one_or_none()

    legacy_condition = Response.submitted_at >= version.created_at

    if next_version is not None:
        legacy_condition = legacy_condition & (Response.submitted_at < next_version.created_at)

    version_condition = or_(
        Response.form_version_id == version.id,
        (Response.form_version_id.is_(None) & legacy_condition),
    )
    query = select(Response).where(Response.form_id == form_id, version_condition)
    count_query = select(func.count(func.distinct(Response.id))).where(Response.form_id == form_id, version_condition)

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    result = await db.execute(query.order_by(Response.submitted_at.desc()).options(selectinload(Response.answers)))
    responses = list(result.scalars().unique().all())
    return responses, total
