import base64
import os
from datetime import datetime, timezone

from googleapiclient.discovery import build

from .google_auth import CREDENTIALS_PATH, TOKEN_PATH, get_credentials  # noqa: F401

DEFAULT_QUERY = os.environ.get("GMAIL_QUERY", "from:notifications@instructure.com")


def _get_service():
    return build("gmail", "v1", credentials=get_credentials())


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
        received_at = None
        internal_date = full.get("internalDate")
        if internal_date:
            received_at = datetime.fromtimestamp(
                int(internal_date) / 1000, tz=timezone.utc
            ).isoformat()
        messages.append(
            {
                "source": "gmail",
                "id": m["id"],
                "sender": _get_header(headers, "From"),
                "subject": subject,
                "text": f"{subject}\n{body}".strip(),
                "received_at": received_at,
            }
        )
    return messages
