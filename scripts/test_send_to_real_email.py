"""
Test script for sending OTP to actual user email addresses
Tests if the email service works with real recipient addresses
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import get_settings
from app.services.email_service import send_email
from app.utils.helpers import normalize_email


async def test_send_to_different_addresses():
    """Test sending emails to different recipient addresses"""
    print("\n" + "="*60)
    print("TEST 1: Send to Different Email Addresses")
    print("="*60)
    
    # Test different email formats
    test_emails = [
        "mithinchandu@gmail.com",  # The user email from profile
        "test.user@gmail.com",
        "another.test@gmail.com",
    ]
    
    for email in test_emails:
        normalized = normalize_email(email)
        print(f"\n  Testing: {email}")
        print(f"  Normalized: {normalized}")
        
        try:
            body = (
                "Your SmartForm verification code is:\n\n"
                "123456\n\n"
                "This code expires in 10 minutes."
            )
            
            result = await send_email(
                subject="Verify your SmartForm email",
                recipients=[normalized],
                body=body
            )
            
            if result:
                print(f"  ✓ PASS - Email sent to {email}")
            else:
                print(f"  ✗ FAIL - Email send returned False")
                
        except Exception as e:
            print(f"  ✗ FAIL - Error: {type(e).__name__}: {e}")


async def test_normalize_email():
    """Test email normalization"""
    print("\n" + "="*60)
    print("TEST 2: Email Normalization")
    print("="*60)
    
    test_cases = [
        ("mithinchandu@gmail.com", "mithinchandu@gmail.com"),
        ("MITHINCHANDU@GMAIL.COM", "mithinchandu@gmail.com"),
        ("  mithinchandu@gmail.com  ", "mithinchandu@gmail.com"),
        ("MithinChandu@Gmail.Com", "mithinchandu@gmail.com"),
    ]
    
    for input_email, expected in test_cases:
        normalized = normalize_email(input_email)
        is_correct = normalized == expected
        status = "✓ PASS" if is_correct else "✗ FAIL"
        print(f"  {status} - {input_email!r} -> {normalized!r}")


async def test_recipients_list_handling():
    """Test different recipient list formats"""
    print("\n" + "="*60)
    print("TEST 3: Recipients List Handling")
    print("="*60)
    
    settings = get_settings()
    
    # Test 1: List with one email
    test_recipients_1 = ["mithinchandu@gmail.com"]
    print(f"\n  Test 1: Single recipient list")
    print(f"  Recipients: {test_recipients_1}")
    
    try:
        result = await send_email(
            subject="Test 1",
            recipients=test_recipients_1,
            body="Test body"
        )
        print(f"  ✓ PASS - Sent to: {', '.join(test_recipients_1)}")
    except Exception as e:
        print(f"  ✗ FAIL - {type(e).__name__}: {e}")
    
    # Test 2: List with multiple emails
    test_recipients_2 = ["mithinchandu@gmail.com", "another@example.com"]
    print(f"\n  Test 2: Multiple recipients")
    print(f"  Recipients: {test_recipients_2}")
    
    try:
        result = await send_email(
            subject="Test 2",
            recipients=test_recipients_2,
            body="Test body"
        )
        print(f"  ✓ PASS - Sent to: {', '.join(test_recipients_2)}")
    except Exception as e:
        print(f"  ✗ FAIL - {type(e).__name__}: {e}")
    
    # Test 3: None or empty values
    print(f"\n  Test 3: Empty recipients")
    try:
        result = await send_email(
            subject="Test 3",
            recipients=[],
            body="Test body"
        )
        if not result:
            print(f"  ✓ PASS - Empty recipients correctly rejected")
        else:
            print(f"  ✗ FAIL - Empty recipients should return False")
    except Exception as e:
        print(f"  ✗ FAIL - {type(e).__name__}: {e}")


async def test_verification_service_flow():
    """Test the actual verification service flow"""
    print("\n" + "="*60)
    print("TEST 4: Verification Service Flow (Simulated)")
    print("="*60)
    
    from app.services.verification_service import send_verification_otp, _email_challenges
    from app.utils.helpers import normalize_email
    
    user_id = "test-user-123"
    user_email = "mithinchandu@gmail.com"
    
    # Clear any existing challenge
    _email_challenges.pop(user_id, None)
    
    print(f"\n  User ID: {user_id}")
    print(f"  User Email: {user_email}")
    print(f"  Normalized: {normalize_email(user_email)}")
    
    try:
        print(f"\n  Calling send_verification_otp()...")
        expires_at = await send_verification_otp(user_id, user_email)
        
        print(f"  ✓ PASS - OTP sent successfully")
        print(f"  Expires at: {expires_at.isoformat()}")
        
        # Verify the challenge was created
        challenge = _email_challenges.get(user_id)
        if challenge:
            print(f"  ✓ Challenge stored: {challenge.email}")
        else:
            print(f"  ✗ Challenge not found in storage")
            
    except RuntimeError as e:
        print(f"  ✗ FAIL - RuntimeError: {e}")
        print(f"  This usually means SMTP credentials are missing")
    except Exception as e:
        print(f"  ✗ FAIL - {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """Run all tests"""
    print("\n" + "█"*60)
    print("█" + " "*58 + "█")
    print("█" + "  EMAIL TO REAL ADDRESSES TEST SUITE".center(58) + "█")
    print("█" + " "*58 + "█")
    print("█"*60)
    
    await test_normalize_email()
    await test_recipients_list_handling()
    await test_send_to_different_addresses()
    await test_verification_service_flow()
    
    # Summary
    print("\n" + "="*60)
    print("NOTES")
    print("="*60)
    print("  If all tests pass but you still get 503 errors:")
    print("  1. Check .env file is loaded correctly")
    print("  2. Verify SMTP credentials haven't changed")
    print("  3. Check Gmail account security settings")
    print("  4. Try disabling 2FA or use App Password")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
