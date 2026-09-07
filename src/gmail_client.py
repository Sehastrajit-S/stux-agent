import base64
import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
TOKEN_PATH = os.environ.get("GMAIL_TOKEN_PATH", "token.json")
CREDENTIALS_PATH = os.environ.get("GMAIL_CREDENTIALS_PATH", "credentials.json")
DEFAULT_QUERY = os.environ.get("GMAIL_QUERY", "from:notifications@instructure.com")


def _get_service():
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, "w", encoding="utf-8") as f:
            f.write(creds.to_json())
    return build("gmail", "v1", credentials=creds)


def _get_header(headers, name):
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


def _decode_body(payload) -> str:
    if "parts" in payload:
        for part in payload["parts"]:
            if part.get("mimeType") == "text/plain":
                data = part.get("body", {}).get("data")
                if data:
                    return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
        return ""
    data = payload.get("body", {}).get("data")
    if data:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    return ""


def fetch_recent_emails(max_results: int = 10, query: str = None) -> list:
    """Fetch recent inbox emails via the Gmail API and normalize them.

    Requires GMAIL_CREDENTIALS_PATH (OAuth client secret JSON from Google Cloud
    Console) and will open a browser for consent on first run, caching the
    resulting token at GMAIL_TOKEN_PATH.

    `query` uses Gmail search syntax (https://support.google.com/mail/answer/7190)
    and defaults to GMAIL_QUERY / "from:notifications@instructure.com" so a run
    only pulls Canvas notification emails, which is where assignment and course
    deadlines actually show up.
    """
    query = DEFAULT_QUERY if query is None else query
    service = _get_service()
    results = (
        service.users()
        .messages()
        .list(userId="me", maxResults=max_results, labelIds=["INBOX"], q=query)
        .execute()
    )
    messages = []
    for m in results.get("messages", []):
        full = service.users().messages().get(userId="me", id=m["id"], format="full").execute()
        headers = full["payload"]["headers"]
        body = _decode_body(full["payload"]) or full.get("snippet", "")
        subject = _get_header(headers, "Subject")
        messages.append(
            {
                "source": "gmail",
                "id": m["id"],
                "sender": _get_header(headers, "From"),
                "subject": subject,
                "text": f"{subject}\n{body}".strip(),
            }
        )
    return messages
