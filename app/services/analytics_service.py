from __future__ import annotations

from datetime import date
import json

from sqlalchemy import func, select, true
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import FormStatus, UserRole
from app.models.answer import Answer
from app.models.form import Form
from app.models.question import Question
from app.models.response import Response
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsDashboard,
    CountItem,
    FormAnalytics,
    OptionAnalytics,
    QuestionAnalytics,
    ResponseAnswerDetail,
    ResponseDetail,
    TimeSeriesPoint,
    TopFormItem,
    UserAnalytics,
)


async def build_dashboard(db: AsyncSession, owner_id: str | None = None) -> AnalyticsDashboard:
    form_filter = (Form.owner_id == owner_id) if owner_id is not None else True

    total_forms = await db.scalar(select(func.count(Form.id)).where(form_filter)) or 0
    total_responses = await db.scalar(
        select(func.count(Response.id)).join(Form, Response.form_id == Form.id).where(form_filter)
    ) or 0
    active_forms = await db.scalar(
        select(func.count(Form.id)).where(Form.status == FormStatus.PUBLISHED, form_filter)
    ) or 0
    draft_forms = await db.scalar(
        select(func.count(Form.id)).where(Form.status == FormStatus.DRAFT, form_filter)
    ) or 0
    average_completion_time = (
        await db.scalar(
            select(func.coalesce(func.avg(Response.completion_time), 0.0))
            .join(Form, Response.form_id == Form.id)
            .where(form_filter)
        ) or 0.0
    )

    completion_rate = 0.0
    if total_forms:
        completion_rate = round((total_responses / total_forms) * 100, 2)

    day_expr = func.date(Response.submitted_at).label("day")
    daily_rows = await db.execute(
        select(day_expr, func.count(Response.id))
        .join(Form, Response.form_id == Form.id)
        .where(form_filter)
        .group_by(day_expr)
        .order_by(day_expr)
    )
    daily_responses = [
        TimeSeriesPoint(date=row.day, count=row[1])
        for row in daily_rows.all()
        if row.day is not None
    ]

    month_expr = func.date_trunc("month", Response.submitted_at).label("month")
    monthly_rows = await db.execute(
        select(month_expr, func.count(Response.id))
        .join(Form, Response.form_id == Form.id)
        .where(form_filter)
        .group_by(month_expr)
        .order_by(month_expr)
    )
    monthly_responses = [
        TimeSeriesPoint(date=row.month.date(), count=row[1])
        for row in monthly_rows.all()
        if row.month is not None
    ]

    top_form_rows = await db.execute(
        select(Form.id, Form.title, func.count(Response.id).label("response_count"))
        .join(Response, Response.form_id == Form.id, isouter=True)
        .where(form_filter)
        .group_by(Form.id)
        .order_by(func.count(Response.id).desc())
        .limit(10)
    )
    top_forms = [TopFormItem(id=row.id, label=row.title, value=row.response_count) for row in top_form_rows.all()]

    device_rows = await db.execute(
        select(Response.device, func.count(Response.id))
        .join(Form, Response.form_id == Form.id)
        .where(form_filter)
        .group_by(Response.device)
        .order_by(func.count(Response.id).desc())
    )
    device_statistics = [
        CountItem(label=row[0] or "Unknown", value=row[1]) for row in device_rows.all()
    ]

    browser_rows = await db.execute(
        select(Response.browser, func.count(Response.id))
        .join(Form, Response.form_id == Form.id)
        .where(form_filter)
        .group_by(Response.browser)
        .order_by(func.count(Response.id).desc())
    )
    browser_statistics = [
        CountItem(label=row[0] or "Unknown", value=row[1]) for row in browser_rows.all()
    ]

    return AnalyticsDashboard(
        total_forms=total_forms,
        total_responses=total_responses,
        active_forms=active_forms,
        draft_forms=draft_forms,
        completion_rate=completion_rate,
        average_completion_time=float(average_completion_time),
        daily_responses=daily_responses,
        monthly_responses=monthly_responses,
        top_forms=top_forms,
        device_statistics=device_statistics,
        browser_statistics=browser_statistics,
    )


async def build_user_analytics(db: AsyncSession) -> UserAnalytics:
    total_users = await db.scalar(select(func.count(User.id))) or 0
    verified_users = await db.scalar(select(func.count(User.id)).where(User.is_verified.is_(True))) or 0
    admin_users = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.ADMIN)) or 0
    active_users = await db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0
    return UserAnalytics(
        total_users=total_users,
        verified_users=verified_users,
        admin_users=admin_users,
        active_users=active_users,
    )


def _parse_answer_values(value: str | None) -> list[str]:
    if value is None or value == "":
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed if str(item).strip()]
    except (TypeError, json.JSONDecodeError):
        pass
    if "," in value:
        return [item.strip() for item in value.split(",") if item.strip()]
    return [value]


async def build_form_analytics(db: AsyncSession, form_id: str) -> FormAnalytics:
    result = await db.execute(
        select(Form)
        .options(
            selectinload(Form.questions).selectinload(Question.options),
            selectinload(Form.responses).selectinload(Response.answers),
        )
        .where(Form.id == form_id)
    )
    form = result.scalar_one()
    questions = sorted(form.questions, key=lambda item: item.order_index)
    responses = sorted(form.responses, key=lambda item: item.submitted_at, reverse=True)
    total_questions = len(questions)
    total_responses = len(responses)

    q_by_id = {question.id: question for question in questions}
    answer_by_question: dict[str, list[Answer]] = {question.id: [] for question in questions}
    answered_cells = 0
    for response in responses:
        seen_in_response: set[str] = set()
        for answer in response.answers:
            if answer.question_id not in answer_by_question:
                continue
            values = _parse_answer_values(answer.answer)
            if values:
                answer_by_question[answer.question_id].append(answer)
                seen_in_response.add(answer.question_id)
        answered_cells += len(seen_in_response)

    question_analytics: list[QuestionAnalytics] = []
    for question in questions:
        answers = answer_by_question[question.id]
        option_labels = [option.option_text for option in question.options]
        option_counts = {label: 0 for label in option_labels}
        text_answers: list[str] = []
        rating_total = 0.0
        rating_count = 0

        for answer in answers:
            values = _parse_answer_values(answer.answer)
            if question.question_type.value in {"radio", "checkbox", "dropdown", "yes_no"}:
                for value in values:
                    if value not in option_counts:
                        option_counts[value] = 0
                    option_counts[value] += 1
            elif question.question_type.value == "rating":
                for value in values:
                    try:
                        rating_total += float(value)
                        rating_count += 1
                    except ValueError:
                        continue
            else:
                if answer.answer:
                    text_answers.append(answer.answer)

        denominator = max(1, len(answers))
        question_analytics.append(
            QuestionAnalytics(
                question_id=question.id,
                title=question.title,
                question_type=question.question_type.value,
                total_answers=len(answers),
                skipped=max(0, total_responses - len(answers)),
                options=[
                    OptionAnalytics(
                        option=option,
                        count=count,
                        percentage=round((count / denominator) * 100, 1),
                    )
                    for option, count in option_counts.items()
                ],
                text_answers=text_answers[:8],
                average_rating=round(rating_total / rating_count, 2) if rating_count else None,
            )
        )

    day_expr = func.date(Response.submitted_at).label("day")
    daily_rows = await db.execute(
        select(day_expr, func.count(Response.id))
        .where(Response.form_id == form_id)
        .group_by(day_expr)
        .order_by(day_expr)
    )
    daily_responses = [
        TimeSeriesPoint(date=row.day, count=row[1])
        for row in daily_rows.all()
        if row.day is not None
    ]

    completion_rate = 0.0
    if total_responses and total_questions:
        completion_rate = round((answered_cells / (total_responses * total_questions)) * 100, 2)

    average_completion_time = 0.0
    completion_values = [response.completion_time for response in responses if response.completion_time is not None]
    if completion_values:
        average_completion_time = round(sum(completion_values) / len(completion_values), 2)

    response_details: list[ResponseDetail] = []
    for index, response in enumerate(responses, start=1):
        answer_details: list[ResponseAnswerDetail] = []
        for answer in response.answers:
            question = q_by_id.get(answer.question_id)
            if question is None:
                snapshot = answer.question_snapshot or {}
                fallback_question_id = answer.question_id or snapshot.get("id") or "deleted-question"
                question_title = snapshot.get("title") or fallback_question_id
                question_type = snapshot.get("type") or "unknown"
            else:
                fallback_question_id = answer.question_id
                question_title = question.title
                question_type = question.question_type.value
            answer_details.append(
                ResponseAnswerDetail(
                    question_id=fallback_question_id,
                    question_title=question_title,
                    question_type=question_type,
                    answer=answer.answer,
                    values=_parse_answer_values(answer.answer),
                )
            )

        respondent_label = response.respondent_email or response.submitted_by or f"Anonymous #{index}"
        response_details.append(
            ResponseDetail(
                id=response.id,
                respondent_label=respondent_label,
                respondent_email=response.respondent_email,
                submitted_by=response.submitted_by,
                submitted_at=response.submitted_at,
                completion_time=response.completion_time,
                device=response.device,
                browser=response.browser,
                answers=answer_details,
            )
        )

    return FormAnalytics(
        form_id=form.id,
        title=form.title,
        total_questions=total_questions,
        total_responses=total_responses,
        average_completion_time=average_completion_time,
        completion_rate=completion_rate,
        daily_responses=daily_responses,
        questions=question_analytics,
        responses=response_details,
    )
