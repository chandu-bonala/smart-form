from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)  # SHA256 pre-hashing supports unlimited length


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: str = Field(min_length=6)  # SHA256 pre-hashing supports unlimited length


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=1)


class VerifyEmailRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class OtpSentResponse(BaseModel):
    message: str
    expires_at: int


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    user: UserRead
    tokens: TokenPair


class TokenPayload(BaseModel):
    sub: str
    type: str | None = None
    exp: int | None = None
