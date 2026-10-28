from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.enums import FormStatus, UserRole
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.user import User
from app.schemas.form import FormCreate, FormList, FormRead, ShareForm, FormUpdate
from app.schemas.form_version import FormVersionList, FormVersionRead
from app.schemas.scheduled_action import (
    SchedulePublishForm,
    ScheduleShareForm,
    ScheduledActionList,
    ScheduledActionRead,
)
from app.schemas.response import ResponseList, ResponseRead
from sqlalchemy import select

from app.services.email_service import send_email
from app.services.form_service import (
    archive_form,
    duplicate_form,
    create_form,
    delete_form,
    get_form_or_404,
    list_forms,
    publish_form_with_version,
    restore_archived_form,
    update_form,
)
from app.services.scheduler_service import list_scheduled_actions_for_form, schedule_publish_form, schedule_share_email

router = APIRouter(prefix="/forms", tags=["Forms"])


async def _ensure_form_access(form: Form, user: User) -> None:
    if user.role != UserRole.ADMIN and form.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this form")


@router.post("", response_model=FormRead, status_code=status.HTTP_201_CREATED)
async def create_new_form(
    payload: FormCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FormRead:
    if payload.owner_id != user.id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot create forms for another user")
    form = await create_form(db, payload)
    return FormRead.model_validate(form)


@router.get("", response_model=FormList)
async def get_forms(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FormList:
    owner_id = None if user.role == UserRole.ADMIN else user.id
    forms = await list_forms(db, owner_id=owner_id)
    return FormList(items=[FormRead.model_validate(form) for form in forms], total=len(forms))


@router.get("/{form_id}/versions", response_model=FormVersionList)
async def get_form_versions(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FormVersionList:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    result = await db.execute(select(FormVersion).where(FormVersion.form_id == form.id).order_by(FormVersion.version_number.desc()))
    versions = list(result.scalars().all())
    return FormVersionList(items=[FormVersionRead.model_validate(version) for version in versions], total=len(versions))


@router.get("/{form_id}/versions/{version_number}/responses", response_model=ResponseList)
async def get_form_version_responses(
    form_id: str,
    version_number: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ResponseList:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)

    # New rows are linked directly to the version; old rows fall back to timestamps.
    from app.services.form_service import list_responses_by_form_version

    responses, total = await list_responses_by_form_version(db, form_id, version_number)
    return ResponseList(items=[ResponseRead.model_validate(r) for r in responses], total=total)


@router.get("/{form_id}", response_model=FormRead)
async def get_form(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FormRead:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    return FormRead.model_validate(form)


@router.put("/{form_id}", response_model=FormRead)
async def update_existing_form(
    form_id: str,
    payload: FormUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FormRead:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    form = await update_form(db, form, payload)
    return FormRead.model_validate(form)


@router.delete("/{form_id}")
async def delete_existing_form(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    await delete_form(db, form)
    return {"message": "Form deleted successfully"}


@router.patch("/{form_id}/publish", response_model=FormRead)
async def publish_existing_form(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FormRead:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    form, _version = await publish_form_with_version(db, form)

    return FormRead.model_validate(form)


@router.post("/{form_id}/publish/schedule", response_model=ScheduledActionRead, status_code=status.HTTP_201_CREATED)
async def schedule_publish_existing_form(
    form_id: str,
    payload: SchedulePublishForm,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScheduledActionRead:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    if form.status == FormStatus.ARCHIVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archived forms cannot be scheduled for publish")
    if form.status == FormStatus.PUBLISHED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Form is already published")
    action = await schedule_publish_form(db, owner_id=user.id, form_id=form.id, run_at=payload.run_at)
    return ScheduledActionRead.model_validate(action)


@router.post("/{form_id}/share")
async def share_form(
    form_id: str,
    payload: ShareForm,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)

    if form.status != FormStatus.PUBLISHED or not form.is_public or form.is_hidden:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Form must be published and public to share by email")

    emails = list(dict.fromkeys([email.strip().lower() for email in payload.emails if email.strip()]))
    if not emails:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one recipient email is required")

    subject = payload.subject.strip() if payload.subject else f"Please fill out this form: {form.title}"
    message = payload.message.strip() if payload.message else "Please complete this form using the link below."
    body = (
        f"{message}\n\n"
        f"{payload.url}\n\n"
        "If the link does not work, paste it into your browser."
    )
    await send_email(subject, emails, body)
    return {"message": "Form shared successfully"}


@router.post("/{form_id}/share/schedule", response_model=ScheduledActionRead, status_code=status.HTTP_201_CREATED)
async def schedule_share_form(
    form_id: str,
    payload: ScheduleShareForm,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScheduledActionRead:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)

    if form.status != FormStatus.PUBLISHED or not form.is_public or form.is_hidden:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Form must be published and public to schedule email sharing",
        )

    action = await schedule_share_email(
        db,
        owner_id=user.id,
        form_id=form.id,
        run_at=payload.run_at,
        emails=payload.emails,
        url=payload.url,
        subject=payload.subject,
        message=payload.message,
    )
    return ScheduledActionRead.model_validate(action)


@router.get("/{form_id}/schedules", response_model=ScheduledActionList)
async def list_form_schedules(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScheduledActionList:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    actions = await list_scheduled_actions_for_form(db, form.id)
    return ScheduledActionList(items=[ScheduledActionRead.model_validate(action) for action in actions], total=len(actions))


@router.patch("/{form_id}/archive", response_model=FormRead)
async def archive_existing_form(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FormRead:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    form = await archive_form(db, form)
    return FormRead.model_validate(form)


@router.patch("/{form_id}/restore", response_model=FormRead)
async def restore_existing_form(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FormRead:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    form = await restore_archived_form(db, form)
    return FormRead.model_validate(form)


@router.patch("/{form_id}/visibility", response_model=FormRead)
async def update_form_visibility(
    form_id: str,
    payload: FormUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FormRead:
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    if payload.is_hidden is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="is_hidden must be provided")
    form = await update_form(db, form, payload)
    return FormRead.model_validate(form)


@router.post("/{form_id}/duplicate", response_model=FormRead, status_code=status.HTTP_201_CREATED)
async def duplicate_form_endpoint(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FormRead:
    """Duplicate a form as a draft copy."""
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)
    
    new_form = await duplicate_form(db, form, user.id)
    return FormRead.model_validate(new_form)
