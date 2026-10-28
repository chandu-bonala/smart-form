import asyncio
from types import SimpleNamespace

import pytest

from app.services import email_service, verification_service


def test_send_verification_otp_stores_challenge_after_email_success(monkeypatch):
    sent_messages = []

    async def fake_send_email(subject, recipients, body):
        sent_messages.append((subject, recipients, body))
        return True

    user_id = "otp-user-success"
    verification_service._email_challenges.pop(user_id, None)
    monkeypatch.setattr(verification_service, "_new_otp", lambda: "123456")
    monkeypatch.setattr(
        verification_service,
        "get_settings",
        lambda: SimpleNamespace(email_otp_expire_minutes=10),
    )
    monkeypatch.setattr(verification_service, "send_email", fake_send_email)

    expires_at = asyncio.run(verification_service.send_verification_otp(user_id, " USER@GMAIL.COM "))

    assert sent_messages == [
        (
            "Verify your SmartForm email",
            ["user@gmail.com"],
            "Your SmartForm verification code is:\n\n123456\n\nThis code expires in 10 minutes.",
        )
    ]
    challenge = verification_service._email_challenges[user_id]
    assert challenge.email == "user@gmail.com"
    assert challenge.expires_at == expires_at
    assert verification_service.verify_email_otp(user_id, "user@gmail.com", "123456") is True


def test_send_verification_otp_does_not_store_challenge_when_email_fails(monkeypatch):
    async def fake_send_email(subject, recipients, body):
        raise RuntimeError("Could not send email: auth failed")

    user_id = "otp-user-failure"
    verification_service._email_challenges.pop(user_id, None)
    monkeypatch.setattr(verification_service, "_new_otp", lambda: "654321")
    monkeypatch.setattr(
        verification_service,
        "get_settings",
        lambda: SimpleNamespace(email_otp_expire_minutes=10),
    )
    monkeypatch.setattr(verification_service, "send_email", fake_send_email)

    with pytest.raises(RuntimeError, match="Could not send email"):
        asyncio.run(verification_service.send_verification_otp(user_id, "user@gmail.com"))

    assert user_id not in verification_service._email_challenges


def test_send_email_wraps_smtp_failures(monkeypatch):
    class FailingSmtp:
        def __init__(self, host, port, timeout):
            self.host = host
            self.port = port
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def starttls(self):
            return None

        def login(self, username, password):
            raise email_service.smtplib.SMTPAuthenticationError(535, b"Bad credentials")

        def send_message(self, message):
            return None

    monkeypatch.setattr(email_service.smtplib, "SMTP", FailingSmtp)
    monkeypatch.setattr(
        email_service,
        "get_settings",
        lambda: SimpleNamespace(
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_username="sender@gmail.com",
            smtp_password="unit-test-password",
            smtp_from_email="sender@gmail.com",
            smtp_use_tls=True,
        ),
    )

    with pytest.raises(RuntimeError, match="Could not send email"):
        asyncio.run(email_service.send_email("Subject", ["recipient@gmail.com"], "Body"))
