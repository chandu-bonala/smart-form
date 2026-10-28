"""
Diagnostic script to check backend configuration issues
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import get_settings


def diagnose_config():
    """Check if configuration is loaded correctly"""
    print("\n" + "="*60)
    print("CONFIGURATION DIAGNOSTIC")
    print("="*60)
    
    settings = get_settings()
    
    print(f"\n  SMTP Configuration:")
    print(f"    Host: {settings.smtp_host}")
    print(f"    Port: {settings.smtp_port}")
    print(f"    Username: {settings.smtp_username}")
    print(f"    Password: {'*' * len(settings.smtp_password) if settings.smtp_password else 'NOT SET'}")
    print(f"    From Email: {settings.smtp_from_email}")
    print(f"    Use TLS: {settings.smtp_use_tls}")
    
    print(f"\n  Email OTP Configuration:")
    print(f"    Expire Minutes: {settings.email_otp_expire_minutes}")
    
    print(f"\n  Database Configuration:")
    print(f"    URL: {settings.database_url[:50]}..." if len(settings.database_url) > 50 else settings.database_url)
    
    # Check for issues
    issues = []
    
    if not settings.smtp_username:
        issues.append("❌ SMTP_USERNAME not set")
    
    if not settings.smtp_password:
        issues.append("❌ SMTP_PASSWORD not set")
    
    if settings.smtp_host != "smtp.gmail.com":
        issues.append(f"⚠️  SMTP_HOST is '{settings.smtp_host}' (expected 'smtp.gmail.com')")
    
    if settings.smtp_port != 587:
        issues.append(f"⚠️  SMTP_PORT is {settings.smtp_port} (expected 587)")
    
    if not settings.smtp_use_tls:
        issues.append("⚠️  SMTP_USE_TLS is False (expected True)")
    
    print(f"\n  Status:")
    if issues:
        for issue in issues:
            print(f"    {issue}")
        return False
    else:
        print(f"    ✓ All configurations look good")
        return True


async def test_endpoint_simulation():
    """Simulate what the endpoint does"""
    print("\n" + "="*60)
    print("ENDPOINT SIMULATION")
    print("="*60)
    
    from app.services.verification_service import send_verification_otp
    from app.core.config import get_settings
    
    settings = get_settings()
    
    # Simulate a user
    test_user_id = "test-user-789"
    test_email = "mithinchandu@gmail.com"
    
    print(f"\n  Simulating POST /api/v1/auth/email-verification/send")
    print(f"  User ID: {test_user_id}")
    print(f"  User Email: {test_email}")
    print(f"  Credentials configured: {bool(settings.smtp_username and settings.smtp_password)}")
    
    try:
        print(f"\n  Calling send_verification_otp()...")
        expires_at = await send_verification_otp(test_user_id, test_email)
        
        print(f"  ✓ SUCCESS - OTP sent")
        print(f"  Expires at: {expires_at.isoformat()}")
        print(f"  Timestamp: {int(expires_at.timestamp())}")
        
        return True
        
    except RuntimeError as e:
        print(f"  ❌ FAILED - RuntimeError: {e}")
        print(f"\n  This error means SMTP credentials are missing!")
        print(f"  Make sure:")
        print(f"    1. .env file exists in project root")
        print(f"    2. Contains SMTP_USERNAME and SMTP_PASSWORD")
        print(f"    3. Backend server was restarted after creating .env")
        return False
        
    except Exception as e:
        print(f"  ❌ FAILED - {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    print("\n" + "█"*60)
    print("█" + " "*58 + "█")
    print("█" + "  BACKEND CONFIGURATION DIAGNOSTIC".center(58) + "█")
    print("█" + " "*58 + "█")
    print("█"*60)
    
    config_ok = diagnose_config()
    endpoint_ok = await test_endpoint_simulation()
    
    print("\n" + "="*60)
    print("TROUBLESHOOTING")
    print("="*60)
    
    if not config_ok:
        print("\n  ⚠️  Configuration problems detected!")
        print("  Action: Check your .env file and ensure all SMTP settings are correct")
        print("           Then restart your backend server")
    
    if not endpoint_ok:
        print("\n  ⚠️  Endpoint simulation failed!")
        print("  Possible causes:")
        print("    1. Backend server not restarted after .env was created")
        print("    2. .env file is in wrong location (should be in project root)")
        print("    3. SMTP credentials are incorrect or expired")
        print("\n  Solution:")
        print("    1. Kill your backend server")
        print("    2. Verify .env file exists: python -c \"from pathlib import Path; print(Path('.env').exists())\"")
        print("    3. Restart backend: python -m uvicorn app.main:app --reload")
    else:
        print("\n  ✓ Everything looks good!")
        print("  If you're still getting 503 errors:")
        print("    1. Make sure backend server is running")
        print("    2. Check server logs for actual error message")
        print("    3. Try a fresh restart of the backend")


if __name__ == "__main__":
    asyncio.run(main())
