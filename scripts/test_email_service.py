"""
Test script for Email Service with actual SMTP connection
Tests if emails can actually be sent using configured credentials
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import get_settings
from app.services.email_service import send_email


async def test_smtp_connection():
    """Test basic SMTP connection"""
    print("\n" + "="*60)
    print("TEST 1: SMTP Connection")
    print("="*60)
    
    settings = get_settings()
    
    print(f"  SMTP Host: {settings.smtp_host}")
    print(f"  SMTP Port: {settings.smtp_port}")
    print(f"  SMTP TLS: {settings.smtp_use_tls}")
    print(f"  SMTP Username: {settings.smtp_username}")
    print(f"  SMTP From Email: {settings.smtp_from_email}")
    
    if not settings.smtp_username or not settings.smtp_password:
        print("\n  ✗ FAIL - Missing SMTP credentials")
        return False
    
    try:
        import smtplib
        
        print(f"\n  Attempting connection to {settings.smtp_host}:{settings.smtp_port}...")
        
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            print(f"  ✓ Connected to SMTP server")
            
            if settings.smtp_use_tls:
                print(f"  Starting TLS...")
                smtp.starttls()
                print(f"  ✓ TLS started")
            
            print(f"  Attempting login with {settings.smtp_username}...")
            smtp.login(settings.smtp_username, settings.smtp_password)
            print(f"  ✓ PASS - Successfully authenticated with SMTP")
            
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"  ✗ FAIL - Authentication failed: {e}")
        print(f"    Check username and password")
        return False
    except smtplib.SMTPException as e:
        print(f"  ✗ FAIL - SMTP error: {e}")
        return False
    except Exception as e:
        print(f"  ✗ FAIL - Connection error: {e}")
        return False


async def test_send_test_email():
    """Test sending an actual email"""
    print("\n" + "="*60)
    print("TEST 2: Send Test Email")
    print("="*60)
    
    settings = get_settings()
    
    # Use the configured SMTP from email
    recipient = settings.smtp_from_email or settings.smtp_username
    
    print(f"  Recipient: {recipient}")
    print(f"  Subject: Test Email from OTP System")
    
    try:
        result = await send_email(
            subject="Test Email from OTP System",
            recipients=[recipient],
            body="This is a test email to verify the SMTP configuration is working correctly.\n\nIf you received this, the email verification system is functional!"
        )
        
        if result:
            print(f"  ✓ PASS - Email sent successfully")
            return True
        else:
            print(f"  ✗ FAIL - Email sending returned False")
            return False
            
    except RuntimeError as e:
        print(f"  ✗ FAIL - Runtime error: {e}")
        return False
    except Exception as e:
        print(f"  ✗ FAIL - Error sending email: {type(e).__name__}: {e}")
        return False


async def test_otp_email():
    """Test sending OTP email"""
    print("\n" + "="*60)
    print("TEST 3: Send OTP Email")
    print("="*60)
    
    settings = get_settings()
    recipient = settings.smtp_from_email or settings.smtp_username
    test_code = "123456"
    
    print(f"  Recipient: {recipient}")
    print(f"  Test OTP: {test_code}")
    
    try:
        body = (
            "Your SmartForm verification code is:\n\n"
            f"{test_code}\n\n"
            f"This code expires in {settings.email_otp_expire_minutes} minutes."
        )
        
        result = await send_email(
            subject="Verify your SmartForm email",
            recipients=[recipient],
            body=body
        )
        
        if result:
            print(f"  ✓ PASS - OTP email sent successfully")
            return True
        else:
            print(f"  ✗ FAIL - OTP email sending returned False")
            return False
            
    except Exception as e:
        print(f"  ✗ FAIL - Error sending OTP email: {type(e).__name__}: {e}")
        return False


async def test_empty_recipients():
    """Test that empty recipients are handled"""
    print("\n" + "="*60)
    print("TEST 4: Empty Recipients Handling")
    print("="*60)
    
    try:
        result = await send_email(
            subject="Test",
            recipients=[],
            body="Test body"
        )
        
        if not result:
            print(f"  ✓ PASS - Empty recipients correctly rejected")
            return True
        else:
            print(f"  ✗ FAIL - Empty recipients should return False")
            return False
            
    except Exception as e:
        print(f"  ✗ FAIL - Unexpected error: {e}")
        return False


async def main():
    """Run all tests"""
    print("\n" + "█"*60)
    print("█" + " "*58 + "█")
    print("█" + "  EMAIL SERVICE VERIFICATION TEST SUITE".center(58) + "█")
    print("█" + " "*58 + "█")
    print("█"*60)
    
    results = []
    
    # Test SMTP connection first
    connection_ok = await test_smtp_connection()
    results.append(("SMTP Connection", connection_ok))
    
    if not connection_ok:
        print("\n" + "!"*60)
        print("! SMTP connection failed - stopping further tests")
        print("! Check your credentials in .env file:")
        print("!   - SMTP_HOST")
        print("!   - SMTP_PORT")
        print("!   - SMTP_USERNAME")
        print("!   - SMTP_PASSWORD")
        print("!   - SMTP_USE_TLS")
        print("!"*60)
    else:
        # Only run email tests if connection works
        results.append(("Send Test Email", await test_send_test_email()))
        results.append(("Send OTP Email", await test_otp_email()))
        results.append(("Empty Recipients", await test_empty_recipients()))
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status} - {test_name}")
    
    print(f"\n  Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n  ✓ Email service is working correctly!")
        print("  Your 503 error should be resolved.")
        return 0
    else:
        print(f"\n  ✗ {total - passed} test(s) failed")
        print("\n  TROUBLESHOOTING:")
        print("  1. Verify credentials in .env file")
        print("  2. Check if Gmail 2FA is enabled (use App Password instead)")
        print("  3. Ensure account isn't blocked for security reasons")
        print("  4. Try connecting manually:")
        print(f"     - Host: {sys.modules['app.core.config'].get_settings().smtp_host}")
        print(f"     - Port: {sys.modules['app.core.config'].get_settings().smtp_port}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
