import json
import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

# Shared by gmail_client.py (read Gmail), google_tasks_client.py (write Google
# Tasks), and google_calendar_client.py (write Calendar events) so all three
# use one token with one combined consent flow instead of asking the user to
# authorize three times.
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/calendar.events",
]
TOKEN_PATH = os.environ.get("GMAIL_TOKEN_PATH", "token.json")
CREDENTIALS_PATH = os.environ.get("GMAIL_CREDENTIALS_PATH", "credentials.json")


def _stored_scopes() -> set:
    """The scopes actually recorded in token.json. Credentials.scopes after
    from_authorized_user_file(path, SCOPES) reflects the SCOPES argument we
    pass in, not what Google actually granted, so it can't be used to detect
    a stale token - read the file's own "scopes" field directly instead."""
    try:
        with open(TOKEN_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return set(data.get("scopes") or [])
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return set()


def _load_stored_credentials():
    """Load token.json if present and it actually covers every scope we now
    need. Returns None (not just invalid) if scopes fell short, so callers
    treat "old token, new scope added" the same as "no token yet" - this is
    what makes adding the Tasks scope self-healing instead of a silent 403."""
    if not os.path.exists(TOKEN_PATH):
        return None
    if not set(SCOPES).issubset(_stored_scopes()):
        return None
    try:
        return Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    except (ValueError, OSError):
        return None


def has_valid_credentials() -> bool:
    """Check connection status without ever triggering the consent flow or a
    network refresh - safe to call from a plain status/GET endpoint."""
    creds = _load_stored_credentials()
    if creds is None:
        return False
    return creds.valid or bool(creds.expired and creds.refresh_token)


def get_credentials() -> Credentials:
    """Return valid credentials, refreshing or running the interactive OAuth
    consent flow (opens a browser) if needed. Only call this from somewhere
    prepared for that to block, e.g. a background thread."""
    creds = _load_stored_credentials()
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, "w", encoding="utf-8") as f:
            f.write(creds.to_json())
    return creds
