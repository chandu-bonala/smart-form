from __future__ import annotations

import asyncio
from email.message import EmailMessage
import smtplib
import socket
from typing import Iterable

from app.core.config import get_settings


async def send_email(subject: str, recipients: Iterable[str], body: str) -> bool:
    settings = get_settings()
    recipient_list = [recipient for recipient in recipients if recipient]
    if not recipient_list:
        return False
    if not settings.smtp_username or not settings.smtp_password:
        raise RuntimeError("SMTP credentials are not configured")

    sender = settings.smtp_from_email or settings.smtp_username
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = ", ".join(recipient_list)
    message.set_content(body)

    def deliver() -> bool:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        return True

    try:
        await asyncio.to_thread(deliver)
    except (OSError, smtplib.SMTPException, socket.timeout) as exc:
        raise RuntimeError(f"Could not send email: {exc}") from exc
    return True
