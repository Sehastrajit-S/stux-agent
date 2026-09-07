import json
from pathlib import Path

from config import load_config
from extractor import extract
from gmail_client import fetch_recent_emails

ROOT = Path(__file__).parent.parent
TASKS_PATH = ROOT / "output" / "tasks_and_courses.json"
ALL_MESSAGES_PATH = ROOT / "output" / "all_messages.json"


def run(limit: int = None, gmail_query: str = None) -> dict:
    """Fetch recent Gmail messages, extract structured records from each, and
    write both the relevant subset and the full set to output/*.json.

    Shared by run_baseline.py (CLI) and backend/main.py (FastAPI) so there is
    one implementation of the actual pipeline, not two copies that can drift.
    """
    config = load_config()
    limit = limit or config.get("limit") or 10
    gmail_query = gmail_query or config.get("gmailQuery")

    messages = fetch_recent_emails(limit, query=gmail_query)
    results = [extract(msg) for msg in messages]

    all_sorted = sorted(results, key=lambda r: r.get("received_at") or "", reverse=True)
    relevant = [r for r in results if r.get("is_relevant")]
    relevant.sort(key=lambda r: r.get("due_date") or "9999-99-99")

    TASKS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(TASKS_PATH, "w", encoding="utf-8") as f:
        json.dump(relevant, f, indent=2)
    with open(ALL_MESSAGES_PATH, "w", encoding="utf-8") as f:
        json.dump(all_sorted, f, indent=2)

    return {"fetched": len(messages), "relevant": relevant, "all": all_sorted}
