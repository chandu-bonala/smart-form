from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole


class UserBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    role: UserRole = UserRole.USER
    profile_image: str | None = None
    is_verified: bool = False
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    email: EmailStr | None = None
    role: UserRole | None = None
    profile_image: str | None = None
    is_verified: bool | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)


class UserAvatarUpdate(BaseModel):
    profile_image: str


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime


class UserList(BaseModel):
    items: list[UserRead]
    total: int
