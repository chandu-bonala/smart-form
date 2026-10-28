from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import get_current_admin, get_current_user
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserList, UserRead, UserUpdate
from app.utils.helpers import ensure_upload_directory
from app.utils.helpers import normalize_email

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/{user_id}/avatar")
async def get_user_avatar(user_id: str, db: AsyncSession = Depends(get_db)) -> FileResponse:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.profile_image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar not found")

    upload_dir = ensure_upload_directory() / "avatars"
    candidates = sorted(upload_dir.glob(f"{user_id}_*"))
    if not candidates:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar file not found")

    file_path = max(candidates, key=lambda item: item.stat().st_mtime)
    media_type = "image/jpeg"
    if file_path.suffix.lower() in {".png"}:
        media_type = "image/png"
    elif file_path.suffix.lower() in {".webp"}:
        media_type = "image/webp"
    elif file_path.suffix.lower() in {".gif"}:
        media_type = "image/gif"
    return FileResponse(file_path, media_type=media_type)


@router.get("/me", response_model=UserRead)
async def read_me(user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(user)


@router.patch("/me", response_model=UserRead)
async def update_me(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserRead:
    updates = payload.model_dump(exclude_unset=True)
    password = updates.pop("password", None)
    updates.pop("is_verified", None)
    email = updates.get("email")
    if email is not None:
        normalized_email = normalize_email(str(email))
        if normalized_email != user.email:
            result = await db.execute(select(User).where(User.email == normalized_email, User.id != user.id))
            if result.scalar_one_or_none() is not None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
            updates["email"] = normalized_email
            user.is_verified = False
    for key, value in updates.items():
        setattr(user, key, value)
    if password:
        user.password_hash = get_password_hash(password)
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.post("/me/avatar", response_model=UserRead)
async def upload_my_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserRead:
    settings = get_settings()
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please upload an image file")

    allowed_suffix = Path(file.filename or "").suffix.lower() or ".jpg"
    if allowed_suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image format")

    avatar_dir = ensure_upload_directory() / "avatars"
    avatar_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{user.id}_{uuid4().hex}{allowed_suffix}"
    file_path = avatar_dir / file_name

    total_bytes = 0
    async with aiofiles.open(file_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            total_bytes += len(chunk)
            if total_bytes > settings.max_upload_size_mb * 1024 * 1024:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image is too large")
            await buffer.write(chunk)

    user.profile_image = f"/api/v1/users/{user.id}/avatar"
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.get("", response_model=UserList)
async def list_users(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)) -> UserList:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = list(result.scalars().all())
    return UserList(items=[UserRead.model_validate(user) for user in users], total=len(users))


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_admin)) -> UserRead:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserRead.model_validate(user)
