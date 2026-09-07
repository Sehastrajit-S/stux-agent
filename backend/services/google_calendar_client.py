from datetime import date, timedelta

from googleapiclient.discovery import build

from .google_auth import get_credentials


def _get_service():
    return build("calendar", "v3", credentials=get_credentials())


def create_event(title: str, description: str, event_date: str) -> dict:
    """Create an all-day event on the user's primary calendar for `event_date`
    ("YYYY-MM-DD"). All-day, since extraction only ever gives us a date, never
    a specific time - Calendar's all-day format wants start == that date and
    end == the following date (the end date is exclusive)."""
    service = _get_service()
    start = date.fromisoformat(event_date)
    end = start + timedelta(days=1)
    body = {
        "summary": title or "(untitled)",
        "description": description or "",
        "start": {"date": start.isoformat()},
        "end": {"date": end.isoformat()},
    }
    return service.events().insert(calendarId="primary", body=body).execute()
