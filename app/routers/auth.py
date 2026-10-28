from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_user_from_token
from app.core.database import get_db
from app.core.security import create_access_token, decode_token, is_token_type
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    GoogleAuthRequest,
    LoginRequest,
    OtpSentResponse,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    VerifyEmailRequest,
)
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import authenticate_google_user, authenticate_user, issue_token_pair, register_user
from app.services.verification_service import send_verification_otp, verify_email_otp

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user_payload = UserCreate(name=payload.name, email=payload.email, password=payload.password)
    try:
        user = await register_user(db, user_payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AuthResponse(user=UserRead.model_validate(user), tokens=issue_token_pair(user))


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await authenticate_user(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return AuthResponse(user=UserRead.model_validate(user), tokens=issue_token_pair(user))


@router.post("/google", response_model=AuthResponse)
async def google_login(payload: GoogleAuthRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    try:
        user = await authenticate_google_user(db, payload.id_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not verify Google sign-in") from exc
    return AuthResponse(user=UserRead.model_validate(user), tokens=issue_token_pair(user))


@router.post("/email-verification/send", response_model=OtpSentResponse)
async def send_email_verification(user: User = Depends(get_user_from_token)) -> OtpSentResponse:
    if user.is_verified:
        return OtpSentResponse(message="Email is already verified", expires_at=0)
    try:
        expires_at = await send_verification_otp(user.id, user.email)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return OtpSentResponse(message="Verification code sent", expires_at=int(expires_at.timestamp()))


@router.post("/email-verification/verify", response_model=UserRead)
async def verify_email(
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_from_token),
) -> UserRead:
    if not verify_email_otp(user.id, user.email, payload.code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code")
    user.is_verified = True
    await db.commit()
    await db.refresh(user)
    return UserRead.model_validate(user)


@router.post("/logout")
async def logout(user: User = Depends(get_user_from_token)) -> dict[str, str]:
    _ = user
    return {"message": "Logged out successfully"}


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest) -> TokenPair:
    if not is_token_type(payload.refresh_token, "refresh"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    token_payload = decode_token(payload.refresh_token)
    subject = token_payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    return TokenPair(access_token=create_access_token(subject), refresh_token=payload.refresh_token)


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_user_from_token)) -> UserRead:
    return UserRead.model_validate(user)
