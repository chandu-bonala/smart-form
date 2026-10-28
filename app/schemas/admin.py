from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.enums import UserRole


class AdminDashboardSummary(BaseModel):
    total_users: int
    active_users: int
    verified_users: int
    admin_users: int
    total_forms: int
    published_forms: int
    draft_forms: int
    archived_forms: int
    total_responses: int


class AdminUserRoleUpdate(BaseModel):
    role: UserRole


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


class AdminUserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    email: str | None = None
    role: UserRole | None = None
    profile_image: str | None = None
    is_verified: bool | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)


class AdminFormCounts(BaseModel):
    total: int
    published: int
    draft: int
    archived: int


class AdminResponseCounts(BaseModel):
    total: int
