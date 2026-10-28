from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from app.core.config import get_settings


class SignedURLService:
    """Generates and verifies signed download URLs for file access control."""

    @staticmethod
    def generate_signed_url(file_id: str, expires_in_hours: int = 24) -> str:
        """Generate a time-limited signed URL for file download."""
        settings = get_settings()
        
        # Calculate expiration time
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)
        expires_timestamp = int(expires_at.timestamp())
        
        # Create signature
        signature_data = f"{file_id}:{expires_timestamp}"
        signature = hmac.new(
            settings.secret_key.encode(),
            signature_data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Build signed URL
        signed_url = f"/api/v1/upload/{file_id}/download?expires={expires_timestamp}&signature={signature}"
        return signed_url

    @staticmethod
    def verify_signed_url(file_id: str, expires_timestamp: int, provided_signature: str) -> tuple[bool, str | None]:
        """Verify a signed URL and check if it has expired."""
        settings = get_settings()
        
        # Check expiration
        current_timestamp = int(datetime.now(timezone.utc).timestamp())
        if current_timestamp > expires_timestamp:
            return False, "URL has expired"
        
        # Verify signature
        signature_data = f"{file_id}:{expires_timestamp}"
        expected_signature = hmac.new(
            settings.secret_key.encode(),
            signature_data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Use constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(expected_signature, provided_signature):
            return False, "Invalid signature"
        
        return True, None
