from __future__ import annotations

import secrets

import httpx
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import TokenPair
from app.schemas.user import UserCreate
from app.utils.helpers import normalize_email


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == normalize_email(email)))
    return result.scalar_one_or_none()


async def register_user(db: AsyncSession, payload: UserCreate) -> User:
    existing_user = await get_user_by_email(db, payload.email)
    if existing_user is not None:
        raise ValueError("Email already registered")

    user = User(
        name=payload.name,
        email=normalize_email(payload.email),
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        profile_image=payload.profile_image,
        is_verified=payload.is_verified,
        is_active=payload.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


async def authenticate_google_user(db: AsyncSession, id_token: str) -> User:
    settings = get_settings()
    if not settings.google_client_ids:
        raise ValueError("Google sign-in is not configured")

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get("https://www.googleapis.com/oauth2/v3/certs")
        response.raise_for_status()
        jwks = response.json()

    payload = None
    for client_id in settings.google_client_ids:
        try:
            payload = jwt.decode(id_token, jwks, algorithms=["RS256"], audience=client_id)
            break
        except JWTError:
            continue
    if payload is None or payload.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise ValueError("Invalid Google sign-in token")

    email = payload.get("email")
    if not email:
        raise ValueError("Google account did not provide an email")

    user = await get_user_by_email(db, email)
    if user is None:
        user = User(
            name=payload.get("name") or email.split("@", 1)[0],
            email=normalize_email(email),
            password_hash=get_password_hash(secrets.token_urlsafe(32)),
            profile_image=payload.get("picture"),
            is_verified=bool(payload.get("email_verified")),
            is_active=True,
        )
        db.add(user)
    else:
        user.name = user.name or payload.get("name") or email.split("@", 1)[0]
        user.profile_image = user.profile_image or payload.get("picture")
        if payload.get("email_verified"):
            user.is_verified = True

    await db.commit()
    await db.refresh(user)
    return user


def issue_token_pair(user: User) -> TokenPair:
    subject = user.id
    return TokenPair(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
    )
