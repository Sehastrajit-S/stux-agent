import json
from pathlib import Path

# backend/services/sync_store.py -> services -> backend -> repo root
ROOT = Path(__file__).resolve().parent.parent.parent
SYNC_PATH = ROOT / "output" / "google_actions_sync.json"


def load_sync_map() -> dict:
    """{source_id: {"kind": "task"|"event", "id": <google id>}} for every
    record already pushed to Google Tasks/Calendar, so re-pushing (a second
    click, a re-run) never creates duplicates."""
    try:
        with open(SYNC_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_sync_map(data: dict) -> None:
    SYNC_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(SYNC_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def mark_synced(source_id: str, kind: str, google_id: str) -> None:
    data = load_sync_map()
    data[source_id] = {"kind": kind, "id": google_id}
    save_sync_map(data)
