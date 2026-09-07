from googleapiclient.discovery import build

from .google_auth import get_credentials


def _get_service():
    return build("tasks", "v1", credentials=get_credentials())


def create_task(title: str, notes: str = "", due_date: str = None) -> dict:
    """Create a task in the user's default Google Tasks list.

    `due_date` is "YYYY-MM-DD" or None; Google Tasks' API wants an RFC3339
    timestamp for the due date (it only actually uses the date part, but the
    field is typed as a full timestamp), so midnight UTC is the convention.
    """
    service = _get_service()
    body = {"title": title or "(untitled)"}
    if notes:
        body["notes"] = notes
    if due_date:
        body["due"] = f"{due_date}T00:00:00.000Z"
    return service.tasks().insert(tasklist="@default", body=body).execute()
