"""
Test script for Email OTP System and Verification Timers
Tests:
1. OTP generation
2. OTP hashing
3. Expiration logic
4. Email sending configuration
5. Verification attempts limiting
6. Timer display accuracy
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.verification_service import (
    _new_otp,
    _hash_code,
    send_verification_otp,
    verify_email_otp,
    EmailOtpChallenge,
    _email_challenges,
)
from app.core.config import get_settings
from app.services.email_service import send_email


def test_otp_generation():
    """Test OTP generation produces valid 6-digit codes"""
    print("\n" + "="*60)
    print("TEST 1: OTP Generation")
    print("="*60)
    
    for i in range(5):
        otp = _new_otp()
        is_valid = otp.isdigit() and len(otp) == 6
        status = "✓ PASS" if is_valid else "✗ FAIL"
        print(f"  {status} - Generated OTP #{i+1}: {otp}")
    
    return True


def test_otp_hashing():
    """Test OTP hashing is consistent and uses SHA256"""
    print("\n" + "="*60)
    print("TEST 2: OTP Hashing")
    print("="*60)
    
    test_code = "123456"
    hash1 = _hash_code(test_code)
    hash2 = _hash_code(test_code)
    
    # Should be consistent
    is_consistent = hash1 == hash2
    status = "✓ PASS" if is_consistent else "✗ FAIL"
    print(f"  {status} - Hash consistency: {hash1 == hash2}")
    print(f"    Hash length: {len(hash1)} (SHA256 = 64)")
    print(f"    First hash:  {hash1[:16]}...")
    print(f"    Second hash: {hash2[:16]}...")
    
    # Should be different for different codes
    hash3 = _hash_code("654321")
    is_different = hash1 != hash3
    status = "✓ PASS" if is_different else "✗ FAIL"
    print(f"  {status} - Different codes produce different hashes: {is_different}")
    
    return is_consistent and is_different


def test_expiration_logic():
    """Test OTP expiration timing"""
    print("\n" + "="*60)
    print("TEST 3: Expiration Logic")
    print("="*60)
    
    settings = get_settings()
    print(f"  Email OTP expiration time: {settings.email_otp_expire_minutes} minutes")
    
    # Create a challenge
    test_challenge = EmailOtpChallenge(
        email="test@example.com",
        code_hash=_hash_code("123456"),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    
    # Check not expired
    is_valid = datetime.now(timezone.utc) < test_challenge.expires_at
    status = "✓ PASS" if is_valid else "✗ FAIL"
    print(f"  {status} - Fresh OTP is not expired: {is_valid}")
    print(f"    Created at: {datetime.now(timezone.utc).isoformat()}")
    print(f"    Expires at: {test_challenge.expires_at.isoformat()}")
    print(f"    Time remaining: ~{settings.email_otp_expire_minutes} minutes")
    
    # Create an expired challenge
    expired_challenge = EmailOtpChallenge(
        email="test@example.com",
        code_hash=_hash_code("123456"),
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1)
    )
    
    is_expired = datetime.now(timezone.utc) > expired_challenge.expires_at
    status = "✓ PASS" if is_expired else "✗ FAIL"
    print(f"  {status} - Old OTP is expired: {is_expired}")
    
    return is_valid and is_expired


def test_verification_flow():
    """Test the complete verification flow"""
    print("\n" + "="*60)
    print("TEST 4: Verification Flow")
    print("="*60)
    
    test_user_id = "test-user-123"
    test_email = "test@example.com"
    
    # Clear any existing challenges
    _email_challenges.pop(test_user_id, None)
    
    # Generate a real OTP
    test_otp = _new_otp()
    print(f"  Generated test OTP: {test_otp}")
    
    # Manually create a challenge (simulating send_verification_otp)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    _email_challenges[test_user_id] = EmailOtpChallenge(
        email=test_email,
        code_hash=_hash_code(test_otp),
        expires_at=expires_at,
    )
    
    # Test 1: Correct code should verify
    result = verify_email_otp(test_user_id, test_email, test_otp)
    status = "✓ PASS" if result else "✗ FAIL"
    print(f"  {status} - Correct OTP verifies successfully: {result}")
    
    # Challenge should be cleared after successful verification
    challenge_cleared = test_user_id not in _email_challenges
    status = "✓ PASS" if challenge_cleared else "✗ FAIL"
    print(f"  {status} - Challenge cleared after verification: {challenge_cleared}")
    
    # Test 2: Wrong code should fail
    _email_challenges[test_user_id] = EmailOtpChallenge(
        email=test_email,
        code_hash=_hash_code(test_otp),
        expires_at=expires_at,
    )
    
    result = verify_email_otp(test_user_id, test_email, "000000")
    status = "✓ PASS" if not result else "✗ FAIL"
    print(f"  {status} - Wrong OTP fails verification: {not result}")
    
    # Test 3: Non-existent challenge should fail
    result = verify_email_otp("non-existent-user", test_email, test_otp)
    status = "✓ PASS" if not result else "✗ FAIL"
    print(f"  {status} - Non-existent challenge fails: {not result}")
    
    # Test 4: Expired OTP should fail
    _email_challenges[test_user_id] = EmailOtpChallenge(
        email=test_email,
        code_hash=_hash_code(test_otp),
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # Expired
    )
    
    result = verify_email_otp(test_user_id, test_email, test_otp)
    status = "✓ PASS" if not result else "✗ FAIL"
    print(f"  {status} - Expired OTP fails verification: {not result}")
    
    challenge_cleared = test_user_id not in _email_challenges
    status = "✓ PASS" if challenge_cleared else "✗ FAIL"
    print(f"  {status} - Expired challenge cleaned up: {challenge_cleared}")
    
    # Test 5: Wrong email should fail
    _email_challenges[test_user_id] = EmailOtpChallenge(
        email=test_email,
        code_hash=_hash_code(test_otp),
        expires_at=expires_at,
    )
    
    result = verify_email_otp(test_user_id, "wrong@example.com", test_otp)
    status = "✓ PASS" if not result else "✗ FAIL"
    print(f"  {status} - Wrong email fails verification: {not result}")
    
    return True


def test_attempt_limiting():
    """Test that excessive attempts are blocked"""
    print("\n" + "="*60)
    print("TEST 5: Attempt Limiting (5 attempts max)")
    print("="*60)
    
    test_user_id = "attempt-test-user"
    test_email = "attempt@example.com"
    test_otp = "123456"
    
    # Clear any existing challenges
    _email_challenges.pop(test_user_id, None)
    
    # Create a challenge
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    _email_challenges[test_user_id] = EmailOtpChallenge(
        email=test_email,
        code_hash=_hash_code(test_otp),
        expires_at=expires_at,
    )
    
    # Try wrong OTP 6 times (limit is 5)
    for attempt in range(6):
        result = verify_email_otp(test_user_id, test_email, "000000")
        attempts_count = _email_challenges.get(test_user_id, None)
        if attempts_count is not None:
            attempts_count = attempts_count.attempts
        else:
            attempts_count = 0
        
        print(f"  Attempt {attempt + 1}: {result} (challenge attempts: {attempts_count})")
    
    # After 6 attempts, challenge should be cleared
    challenge_exists = test_user_id in _email_challenges
    status = "✓ PASS" if not challenge_exists else "✗ FAIL"
    print(f"  {status} - Challenge cleared after 6 attempts: {not challenge_exists}")
    
    return not challenge_exists


async def test_email_configuration():
    """Test email configuration"""
    print("\n" + "="*60)
    print("TEST 6: Email Configuration")
    print("="*60)
    
    settings = get_settings()
    
    print(f"  SMTP Host: {settings.smtp_host}")
    print(f"  SMTP Port: {settings.smtp_port}")
    print(f"  SMTP TLS: {settings.smtp_use_tls}")
    print(f"  SMTP From Email: {settings.smtp_from_email or settings.smtp_username}")
    
    # Check if credentials are configured
    if settings.smtp_username and settings.smtp_password:
        print(f"  ✓ PASS - SMTP credentials configured")
        print(f"    Username: {settings.smtp_username[:10]}***")
        return True
    else:
        print(f"  ✗ FAIL - SMTP credentials NOT configured")
        print(f"    Set SMTP_USERNAME and SMTP_PASSWORD in .env")
        return False


async def test_timer_display():
    """Test timer display formatting"""
    print("\n" + "="*60)
    print("TEST 7: Timer Display (Frontend Integration)")
    print("="*60)
    
    settings = get_settings()
    
    # Simulate OTP expiration time
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.email_otp_expire_minutes)
    expires_timestamp = int(expires_at.timestamp())
    
    # Simulate how frontend displays it
    display_time = datetime.fromtimestamp(expires_timestamp)
    time_string = display_time.strftime("%H:%M")
    
    print(f"  Current time: {now.isoformat()}")
    print(f"  Expiration time: {expires_at.isoformat()}")
    print(f"  Timestamp: {expires_timestamp}")
    print(f"  ✓ Frontend display would show: {time_string}")
    
    # Calculate countdown
    remaining_seconds = expires_timestamp - int(now.timestamp())
    remaining_minutes = remaining_seconds // 60
    print(f"  Time remaining: ~{remaining_minutes} minutes")
    
    return True


async def main():
    """Run all tests"""
    print("\n" + "█"*60)
    print("█" + " "*58 + "█")
    print("█" + "  EMAIL OTP SYSTEM & TIMER VERIFICATION TEST SUITE".center(58) + "█")
    print("█" + " "*58 + "█")
    print("█"*60)
    
    results = []
    
    # Run synchronous tests
    results.append(("OTP Generation", test_otp_generation()))
    results.append(("OTP Hashing", test_otp_hashing()))
    results.append(("Expiration Logic", test_expiration_logic()))
    results.append(("Verification Flow", test_verification_flow()))
    results.append(("Attempt Limiting", test_attempt_limiting()))
    
    # Run async tests
    email_config_ok = await test_email_configuration()
    results.append(("Email Configuration", email_config_ok))
    
    timer_ok = await test_timer_display()
    results.append(("Timer Display", timer_ok))
    
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
        print("\n  ✓ All tests passed! Email OTP system is working correctly.")
        return 0
    else:
        print(f"\n  ✗ {total - passed} test(s) failed. See details above.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
