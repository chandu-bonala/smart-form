from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.core.security import get_password_hash
from app.models.enums import FormStatus, UserRole
from app.models.form import Form
from app.models.response import Response
from app.models.user import User
from app.schemas.admin import AdminDashboardSummary, AdminUserRoleUpdate, AdminUserStatusUpdate, AdminUserUpdate
from app.schemas.analytics import AnalyticsDashboard, FormAnalytics, UserAnalytics
from app.schemas.form import FormList, FormRead
from app.schemas.response import ResponseList, ResponseRead
from app.schemas.user import UserList, UserRead
from app.services.analytics_service import build_dashboard, build_form_analytics, build_user_analytics
from app.services.form_service import get_form_or_404, list_forms, list_responses_by_form
from app.services.form_service import list_responses_paginated
from app.utils.helpers import normalize_email

router = APIRouter(prefix="/admin", tags=["Admin"])


async def _ensure_unique_email(db: AsyncSession, email: str, user_id: str | None = None) -> str:
    normalized_email = normalize_email(email)
    statement = select(User.id).where(func.lower(User.email) == normalized_email)
    if user_id is not None:
        statement = statement.where(User.id != user_id)
    result = await db.execute(statement.limit(1))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    return normalized_email


async def _get_user_or_404(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


async def _ensure_last_admin_survives(db: AsyncSession, target: User, next_role: UserRole, next_is_active: bool) -> None:
    if target.role != UserRole.ADMIN:
        return
    if next_role == UserRole.ADMIN and next_is_active:
        return

    result = await db.execute(
        select(func.count(User.id)).where(
            User.role == UserRole.ADMIN,
            User.is_active.is_(True),
            User.id != target.id,
        )
    )
    other_active_admins = result.scalar() or 0
    if other_active_admins == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one active admin account must remain",
        )


@router.get("/dashboard", response_model=AdminDashboardSummary)
async def dashboard(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AdminDashboardSummary:
    total_users = await db.scalar(select(func.count(User.id))) or 0
    active_users = await db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0
    verified_users = await db.scalar(select(func.count(User.id)).where(User.is_verified.is_(True))) or 0
    admin_users = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.ADMIN)) or 0
    total_forms = await db.scalar(select(func.count(Form.id))) or 0
    published_forms = await db.scalar(select(func.count(Form.id)).where(Form.status == FormStatus.PUBLISHED)) or 0
    draft_forms = await db.scalar(select(func.count(Form.id)).where(Form.status == FormStatus.DRAFT)) or 0
    archived_forms = await db.scalar(select(func.count(Form.id)).where(Form.status == FormStatus.ARCHIVED)) or 0
    total_responses = await db.scalar(select(func.count(Response.id))) or 0

    return AdminDashboardSummary(
        total_users=total_users,
        active_users=active_users,
        verified_users=verified_users,
        admin_users=admin_users,
        total_forms=total_forms,
        published_forms=published_forms,
        draft_forms=draft_forms,
        archived_forms=archived_forms,
        total_responses=total_responses,
    )


@router.get("/analytics/dashboard")
async def analytics_dashboard(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AnalyticsDashboard:
    return await build_dashboard(db)


@router.get("/analytics/users", response_model=UserAnalytics)
async def analytics_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> UserAnalytics:
    return await build_user_analytics(db)


@router.get("/users", response_model=UserList)
async def list_admin_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
    search: str | None = Query(default=None, min_length=1),
    role: UserRole | None = None,
    is_active: bool | None = None,
    is_verified: bool | None = None,
) -> UserList:
    statement = select(User).order_by(User.created_at.desc())

    if search:
        search_pattern = f"%{search.strip().lower()}%"
        statement = statement.where(
            func.lower(User.name).like(search_pattern) | func.lower(User.email).like(search_pattern)
        )
    if role is not None:
        statement = statement.where(User.role == role)
    if is_active is not None:
        statement = statement.where(User.is_active.is_(is_active))
    if is_verified is not None:
        statement = statement.where(User.is_verified.is_(is_verified))

    result = await db.execute(statement)
    users = list(result.scalars().all())
    return UserList(items=[UserRead.model_validate(user) for user in users], total=len(users))


@router.get("/users/{user_id}", response_model=UserRead)
async def get_admin_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> UserRead:
    user = await _get_user_or_404(db, user_id)
    return UserRead.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserRead)
async def update_admin_user(
    user_id: str,
    payload: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserRead:
    user = await _get_user_or_404(db, user_id)
    updates = payload.model_dump(exclude_unset=True)

    next_role = updates.get("role", user.role)
    next_is_active = updates.get("is_active", user.is_active)
    await _ensure_last_admin_survives(db, user, next_role, next_is_active)

    if user.id == current_admin.id:
        if updates.get("role") is not None and updates["role"] != UserRole.ADMIN:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot demote your own admin account")
        if updates.get("is_active") is False:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own admin account")

    if "email" in updates and updates["email"] is not None:
        updates["email"] = await _ensure_unique_email(db, str(updates["email"]), user.id)

    password = updates.pop("password", None)
    for key, value in updates.items():
        setattr(user, key, value)
    if password:
        user.password_hash = get_password_hash(password)

    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.patch("/users/{user_id}/role", response_model=UserRead)
async def update_admin_user_role(
    user_id: str,
    payload: AdminUserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserRead:
    user = await _get_user_or_404(db, user_id)
    await _ensure_last_admin_survives(db, user, payload.role, user.is_active)

    if user.id == current_admin.id and payload.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot demote your own admin account")

    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.patch("/users/{user_id}/status", response_model=UserRead)
async def update_admin_user_status(
    user_id: str,
    payload: AdminUserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> UserRead:
    user = await _get_user_or_404(db, user_id)
    await _ensure_last_admin_survives(db, user, user.role, payload.is_active)

    if user.id == current_admin.id and not payload.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own admin account")

    user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.get("/forms", response_model=FormList)
async def list_admin_forms(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> FormList:
    forms = await list_forms(db)
    return FormList(items=[FormRead.model_validate(form) for form in forms], total=len(forms))


@router.get("/forms/{form_id}", response_model=FormRead)
async def get_admin_form(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> FormRead:
    form = await get_form_or_404(db, form_id)
    return FormRead.model_validate(form)


@router.get("/forms/{form_id}/responses", response_model=ResponseList)
async def get_admin_form_responses(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> ResponseList:
    responses = await list_responses_by_form(db, form_id)
    return ResponseList(items=[ResponseRead.model_validate(response) for response in responses], total=len(responses))


@router.get("/forms/{form_id}/responses/search", response_model=ResponseList)
async def search_admin_form_responses(
    form_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: date | None = None,
    end_date: date | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> ResponseList:
    responses, total = await list_responses_paginated(
        db,
        form_id=form_id,
        page=page,
        page_size=page_size,
        start_date=start_date,
        end_date=end_date,
        search_query=search,
    )
    return ResponseList(items=[ResponseRead.model_validate(response) for response in responses], total=total)


@router.get("/forms/{form_id}/analytics")
async def get_admin_form_analytics(
    form_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> FormAnalytics:
    return await build_form_analytics(db, form_id)
