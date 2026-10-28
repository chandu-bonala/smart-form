import os
import sys
import requests

BASE_URL = os.environ.get('API_BASE', 'http://localhost:8000')
API_PREFIX = '/api/v1'

USERS = [
    {'email': 'raphateam1@gmail.com', 'password': 'Chandu*392005'},
    {'email': 'mithinchandubonala@gmail.com', 'password': 'Chandu*392005'},
]


def login(email: str, password: str) -> str | None:
    url = f"{BASE_URL}{API_PREFIX}/auth/login"
    try:
        resp = requests.post(url, json={'email': email, 'password': password}, timeout=10)
    except Exception as e:
        print(f"ERROR: Could not connect to {url}: {e}")
        return None
    if resp.status_code != 200:
        print(f"Login failed for {email}: {resp.status_code} {resp.text}")
        return None
    data = resp.json()
    token = data.get('tokens', {}).get('access_token')
    if not token:
        print(f"Login response missing access token for {email}: {data}")
        return None
    return token


def get_forms(token: str):
    url = f"{BASE_URL}{API_PREFIX}/forms"
    headers = {'Authorization': f'Bearer {token}'}
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code != 200:
        print(f"GET /forms failed: {resp.status_code} {resp.text}")
        return None
    return resp.json()


if __name__ == '__main__':
    any_success = False
    for u in USERS:
        print('\nUser:', u['email'])
        token = login(u['email'], u['password'])
        if not token:
            continue
        any_success = True
        forms = get_forms(token)
        if forms is None:
            continue
        items = forms.get('items', [])
        total = forms.get('total', len(items))
        print(f"Found {total} forms")
        for i, f in enumerate(items, start=1):
            title = f.get('title') or f.get('name') or '<untitled>'
            print(f"  {i}. {title}")

    if not any_success:
        print('\nNo successful logins — ensure the backend is running and reachable at', BASE_URL)
        sys.exit(2)
