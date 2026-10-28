from __future__ import annotations

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT_DIR = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT_DIR / "scripts" / "auth_test.html"
BACKEND_ENV_PATH = ROOT_DIR / ".env"
FRONTEND_ENV_PATH = ROOT_DIR / "SmartForm" / ".env"


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


class AuthTestHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed_path = urlparse(self.path).path

        if parsed_path == "/config.json":
            self.send_config()
            return

        if parsed_path in {"/", "/auth_test.html"}:
            self.send_html()
            return

        self.send_error(404, "Not found")

    def send_html(self) -> None:
        content = HTML_PATH.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def send_config(self) -> None:
        backend_env = load_env(BACKEND_ENV_PATH)
        frontend_env = load_env(FRONTEND_ENV_PATH)

        api_base_url = frontend_env.get("EXPO_PUBLIC_API_BASE_URL", "http://localhost:8080").rstrip("/")
        api_version = frontend_env.get("EXPO_PUBLIC_API_VERSION", "/api/v1").strip("/")
        if api_version:
            api_base_url = f"{api_base_url}/{api_version}"

        google_client_id = frontend_env.get("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID", "") or frontend_env.get("GOOGLE_CLIENT_ID", "")

        payload = {
            "apiBaseUrl": api_base_url,
            "googleClientId": google_client_id,
            "backendGoogleClientIds": backend_env.get("GOOGLE_CLIENT_IDS", ""),
        }
        content = json.dumps(payload).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


def main() -> None:
    host = "127.0.0.1"
    port = 19007
    server = ThreadingHTTPServer((host, port), AuthTestHandler)
    print(f"Auth tester running at http://{host}:{port}")
    print("Keep this terminal open while testing.")
    server.serve_forever()


if __name__ == "__main__":
    main()
