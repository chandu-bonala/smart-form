from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.analytics import AnalyticsDashboard, FormAnalytics, UserAnalytics
from app.services.analytics_service import build_dashboard, build_form_analytics, build_user_analytics
from app.services.form_service import get_form_or_404

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=AnalyticsDashboard)
async def dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalyticsDashboard:
    owner_id = None if user.role == UserRole.ADMIN else user.id
    return await build_dashboard(db, owner_id=owner_id)


@router.get("/forms")
async def form_analytics(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> dict[str, int]:
    dashboard = await build_dashboard(db)
    return {"total_forms": dashboard.total_forms, "active_forms": dashboard.active_forms, "draft_forms": dashboard.draft_forms}


@router.get("/responses")
async def response_analytics(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> dict[str, float | int]:
    dashboard = await build_dashboard(db)
    return {
        "total_responses": dashboard.total_responses,
        "completion_rate": dashboard.completion_rate,
        "average_completion_time": dashboard.average_completion_time,
    }


@router.get("/users", response_model=UserAnalytics)
async def user_analytics(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
) -> UserAnalytics:
    return await build_user_analytics(db)


@router.get("/forms/{form_id}", response_model=FormAnalytics)
async def single_form_analytics(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FormAnalytics:
    form = await get_form_or_404(db, form_id)
    if user.role != UserRole.ADMIN and form.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to access this form")
    return await build_form_analytics(db, form_id)
