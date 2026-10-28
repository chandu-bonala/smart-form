from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.enums import UserRole
from app.models.form import Form
from app.models.user import User
from app.schemas.response import ResponseList, ResponseRead
from app.services.form_service import (
    get_form_or_404,
    list_responses_paginated,
)

router = APIRouter(prefix="/responses-search", tags=["Response Search"])


async def _ensure_form_access(form: Form, user: User) -> None:
    if user.role != UserRole.ADMIN and form.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this form")


@router.get("/forms/{form_id}")
async def search_form_responses(
    form_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: date | None = None,
    end_date: date | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ResponseList:
    """Search and filter form responses with pagination."""
    form = await get_form_or_404(db, form_id)
    await _ensure_form_access(form, user)

    responses, total = await list_responses_paginated(
        db,
        form_id=form_id,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
        search_query=search,
    )

    return ResponseList(
        items=[ResponseRead.model_validate(r) for r in responses],
        total=total,
    )
