from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings


def _pre_hash_password(password: str) -> str:
    """SHA256 hash password before bcrypt to support unlimited length."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pre_hashed = _pre_hash_password(plain_password)
    try:
        return bcrypt.checkpw(pre_hashed.encode(), hashed_password.encode())
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    pre_hashed = _pre_hash_password(password)
    return bcrypt.hashpw(pre_hashed.encode(), bcrypt.gensalt()).decode()


def _create_token(payload: dict[str, Any], expires_delta: timedelta, token_type: str) -> str:
    settings = get_settings()
    to_encode = payload.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire, "type": token_type})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    settings = get_settings()
    payload: dict[str, Any] = {"sub": subject}
    if extra_claims:
        payload.update(extra_claims)
    return _create_token(payload, timedelta(minutes=settings.access_token_expire_minutes), "access")


def create_refresh_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    settings = get_settings()
    payload: dict[str, Any] = {"sub": subject}
    if extra_claims:
        payload.update(extra_claims)
    return _create_token(payload, timedelta(days=settings.refresh_token_expire_days), "refresh")


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def is_token_type(token: str, expected_type: str) -> bool:
    try:
        payload = decode_token(token)
    except JWTError:
        return False
    return payload.get("type") == expected_type
