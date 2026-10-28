from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.enums import FormStatus, ScheduledActionStatus, ScheduledActionType
from app.models.form import Form
from app.models.scheduled_action import ScheduledAction
from app.services.email_service import send_email
from app.services.form_service import publish_form_with_version

POLL_INTERVAL_SECONDS = 20

_scheduler_task: asyncio.Task | None = None
_scheduler_stop_event: asyncio.Event | None = None


def _normalize_run_at(run_at: datetime) -> datetime:
    if run_at.tzinfo is None:
        return run_at.replace(tzinfo=timezone.utc)
    return run_at.astimezone(timezone.utc)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_emails(emails: list[str]) -> list[str]:
    return list(dict.fromkeys([email.strip().lower() for email in emails if email.strip()]))


def _build_email_body(message: str | None, url: str) -> str:
    body = (message or "Please complete this form using the link below.").strip()
    return f"{body}\n\n{url}\n\nIf the link does not work, paste it into your browser."


async def create_scheduled_action(
    db: AsyncSession,
    *,
    owner_id: str,
    form_id: str,
    action_type: ScheduledActionType,
    run_at: datetime,
    payload: dict[str, Any],
) -> ScheduledAction:
    scheduled_for = _normalize_run_at(run_at)
    if scheduled_for <= _now_utc():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Schedule time must be in the future")

    action = ScheduledAction(
        owner_id=owner_id,
        form_id=form_id,
        action_type=action_type,
        run_at=scheduled_for,
        payload=payload,
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return action


async def schedule_publish_form(db: AsyncSession, *, owner_id: str, form_id: str, run_at: datetime) -> ScheduledAction:
    return await create_scheduled_action(
        db,
        owner_id=owner_id,
        form_id=form_id,
        action_type=ScheduledActionType.PUBLISH_FORM,
        run_at=run_at,
        payload={"form_id": form_id},
    )


async def schedule_share_email(
    db: AsyncSession,
    *,
    owner_id: str,
    form_id: str,
    run_at: datetime,
    emails: list[str],
    url: str,
    subject: str | None = None,
    message: str | None = None,
) -> ScheduledAction:
    normalized_emails = _normalize_emails(emails)
    if not normalized_emails:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one recipient email is required")

    return await create_scheduled_action(
        db,
        owner_id=owner_id,
        form_id=form_id,
        action_type=ScheduledActionType.SEND_EMAIL,
        run_at=run_at,
        payload={
            "emails": normalized_emails,
            "url": url,
            "subject": subject.strip() if subject else None,
            "message": message.strip() if message else None,
        },
    )


async def list_scheduled_actions_for_form(db: AsyncSession, form_id: str) -> list[ScheduledAction]:
    result = await db.execute(
        select(ScheduledAction)
        .where(ScheduledAction.form_id == form_id)
        .order_by(ScheduledAction.run_at.asc())
    )
    return list(result.scalars().all())


async def _claim_action(db: AsyncSession, action_id: str) -> bool:
    result = await db.execute(
        update(ScheduledAction)
        .where(ScheduledAction.id == action_id, ScheduledAction.status == ScheduledActionStatus.PENDING)
        .values(status=ScheduledActionStatus.PROCESSING)
    )
    await db.commit()
    return (result.rowcount or 0) > 0


async def _finalize_action(
    db: AsyncSession,
    action_id: str,
    *,
    status_value: ScheduledActionStatus,
    error_message: str | None = None,
) -> None:
    values: dict[str, Any] = {"status": status_value}
    if status_value == ScheduledActionStatus.COMPLETED:
        values["executed_at"] = _now_utc()
        values["error_message"] = None
    else:
        values["error_message"] = error_message

    await db.execute(update(ScheduledAction).where(ScheduledAction.id == action_id).values(**values))
    await db.commit()


async def _execute_publish_action(db: AsyncSession, action: ScheduledAction) -> None:
    result = await db.execute(select(Form).where(Form.id == action.form_id))
    form = result.scalar_one_or_none()
    if form is None:
        raise RuntimeError("Scheduled form no longer exists")
    if form.status == FormStatus.ARCHIVED:
        raise RuntimeError("Archived forms cannot be published automatically")
    if form.status == FormStatus.PUBLISHED:
        return
    await publish_form_with_version(db, form)


async def _execute_email_action(action: ScheduledAction) -> None:
    payload = action.payload or {}
    emails_value = payload.get("emails") or []
    emails = _normalize_emails(list(emails_value))
    if not emails:
        raise RuntimeError("Scheduled email has no recipients")
    url = str(payload.get("url") or "").strip()
    if not url:
        raise RuntimeError("Scheduled email is missing a form URL")
    subject = str(payload.get("subject") or f"Please fill out this form: {action.form_id}").strip()
    message = payload.get("message")
    body = _build_email_body(str(message) if message is not None else None, url)
    await send_email(subject, emails, body)


async def process_due_scheduled_actions(db: AsyncSession) -> int:
    now = _now_utc()
    result = await db.execute(
        select(ScheduledAction)
        .where(
            ScheduledAction.status == ScheduledActionStatus.PENDING,
            ScheduledAction.run_at <= now,
        )
        .order_by(ScheduledAction.run_at.asc())
        .limit(25)
    )
    actions = list(result.scalars().all())
    processed = 0

    for action in actions:
        claimed = await _claim_action(db, action.id)
        if not claimed:
            continue

        try:
            if action.action_type == ScheduledActionType.PUBLISH_FORM:
                await _execute_publish_action(db, action)
            elif action.action_type == ScheduledActionType.SEND_EMAIL:
                await _execute_email_action(action)
            else:
                raise RuntimeError(f"Unsupported scheduled action type: {action.action_type}")
            await _finalize_action(db, action.id, status_value=ScheduledActionStatus.COMPLETED)
        except Exception as exc:  # pragma: no cover - defensive background execution path
            await _finalize_action(db, action.id, status_value=ScheduledActionStatus.FAILED, error_message=str(exc))
        processed += 1

    return processed


async def _scheduler_loop() -> None:
    assert _scheduler_stop_event is not None
    while not _scheduler_stop_event.is_set():
        try:
            async with AsyncSessionLocal() as db:
                await process_due_scheduled_actions(db)
        except Exception:
            pass

        try:
            await asyncio.wait_for(_scheduler_stop_event.wait(), timeout=POLL_INTERVAL_SECONDS)
        except TimeoutError:
            continue


async def start_scheduler() -> None:
    global _scheduler_task, _scheduler_stop_event
    if _scheduler_task and not _scheduler_task.done():
        return

    _scheduler_stop_event = asyncio.Event()
    async with AsyncSessionLocal() as db:
        await process_due_scheduled_actions(db)
    _scheduler_task = asyncio.create_task(_scheduler_loop())


async def stop_scheduler() -> None:
    global _scheduler_task, _scheduler_stop_event
    if _scheduler_stop_event is not None:
        _scheduler_stop_event.set()
    if _scheduler_task is not None:
        _scheduler_task.cancel()
        with suppress(asyncio.CancelledError):
            await _scheduler_task
    _scheduler_task = None
    _scheduler_stop_event = None
