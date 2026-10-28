from __future__ import annotations

import argparse
import json
import secrets
import sys
import urllib.parse
import urllib.request
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_ENV = ROOT_DIR / ".env"
FRONTEND_ENV = ROOT_DIR / "SmartForm" / ".env"


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def build_google_auth_url(client_id: str, redirect_uri: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "id_token",
        "scope": "openid profile email",
        "nonce": secrets.token_urlsafe(24),
        "state": secrets.token_urlsafe(24),
        "prompt": "select_account",
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)


def post_google_token(api_base_url: str, id_token: str) -> tuple[int, str]:
    url = api_base_url.rstrip("/") + "/auth/google"
    body = json.dumps({"id_token": id_token}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify SmartForm Google OAuth config and optionally test /auth/google with an ID token."
    )
    parser.add_argument("--id-token", help="Google ID token returned by browser OAuth.")
    parser.add_argument("--api-base-url", default="http://localhost:8080/api/v1")
    parser.add_argument("--redirect-uri", default="http://localhost:19006/")
    args = parser.parse_args()

    backend_env = load_env(BACKEND_ENV)
    frontend_env = load_env(FRONTEND_ENV)

    backend_client_ids = split_csv(backend_env.get("GOOGLE_CLIENT_IDS"))
    frontend_web_client_id = frontend_env.get("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID", "")

    print("Backend GOOGLE_CLIENT_IDS:", ", ".join(backend_client_ids) if backend_client_ids else "missing")
    print("Frontend EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:", frontend_web_client_id or "missing")

    if not backend_client_ids or not frontend_web_client_id:
        print("FAIL: Google client ID is missing from backend or frontend env.")
        return 1

    if frontend_web_client_id not in backend_client_ids:
        print("FAIL: Frontend Google client ID is not allowed by backend GOOGLE_CLIENT_IDS.")
        return 1

    print("OK: Frontend and backend Google client IDs match.")
    print("Browser OAuth URL:")
    print(build_google_auth_url(frontend_web_client_id, args.redirect_uri))

    if not args.id_token:
        print("No --id-token provided, so backend login was not attempted.")
        return 0

    status, response_body = post_google_token(args.api_base_url, args.id_token)
    print(f"Backend /auth/google status: {status}")
    print(response_body)
    return 0 if status == 200 else 1


if __name__ == "__main__":
    sys.exit(main())
