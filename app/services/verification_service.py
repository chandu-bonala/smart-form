from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from app.core.config import get_settings
from app.services.email_service import send_email
from app.utils.helpers import normalize_email


@dataclass
class EmailOtpChallenge:
    email: str
    code_hash: str
    expires_at: datetime
    attempts: int = 0


_email_challenges: dict[str, EmailOtpChallenge] = {}


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _new_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


async def send_verification_otp(user_id: str, email: str) -> datetime:
    settings = get_settings()
    normalized_email = normalize_email(email)
    code = _new_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.email_otp_expire_minutes)
    body = (
        "Your SmartForm verification code is:\n\n"
        f"{code}\n\n"
        f"This code expires in {settings.email_otp_expire_minutes} minutes."
    )
    await send_email("Verify your SmartForm email", [normalized_email], body)
    _email_challenges[user_id] = EmailOtpChallenge(
        email=normalized_email,
        code_hash=_hash_code(code),
        expires_at=expires_at,
    )
    return expires_at


def verify_email_otp(user_id: str, email: str, code: str) -> bool:
    challenge = _email_challenges.get(user_id)
    if challenge is None:
        return False

    if datetime.now(timezone.utc) > challenge.expires_at:
        _email_challenges.pop(user_id, None)
        return False

    if challenge.email != normalize_email(email):
        return False

    challenge.attempts += 1
    if challenge.attempts > 5:
        _email_challenges.pop(user_id, None)
        return False

    if not secrets.compare_digest(challenge.code_hash, _hash_code(code.strip())):
        return False

    _email_challenges.pop(user_id, None)
    return True
