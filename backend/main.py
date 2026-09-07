import json
import os
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

sys.path.insert(0, str(ROOT / "src"))

from config import CONFIG_PATH, load_config  # noqa: E402
from gmail_client import CREDENTIALS_PATH, DEFAULT_QUERY, TOKEN_PATH, _get_service  # noqa: E402
from pipeline import ALL_MESSAGES_PATH, TASKS_PATH, run as run_pipeline  # noqa: E402

app = FastAPI(title="Stux Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _iso(mtime: Optional[float]) -> Optional[str]:
    if mtime is None:
        return None
    return datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()


def _read_json(path: Path):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data, path.stat().st_mtime, None
    except FileNotFoundError:
        return [], None, "not_found"
    except (json.JSONDecodeError, OSError) as err:
        return [], None, f"read_error: {err}"


@app.get("/api/tasks")
def get_tasks():
    data, mtime, error = _read_json(TASKS_PATH)
    return {"records": data, "generatedAt": _iso(mtime), "error": error}


@app.get("/api/messages")
def get_messages():
    data, mtime, error = _read_json(ALL_MESSAGES_PATH)
    return {"messages": data, "generatedAt": _iso(mtime), "error": error}


class RunRequest(BaseModel):
    limit: Optional[int] = None
    gmail_query: Optional[str] = None


@app.post("/api/run")
def trigger_run(body: RunRequest = RunRequest()):
    if "OPENAI_API_KEY" not in os.environ:
        raise HTTPException(400, "OPENAI_API_KEY not set in the backend's environment.")
    result = run_pipeline(limit=body.limit, gmail_query=body.gmail_query)
    return {"fetched": result["fetched"], "relevant": len(result["relevant"])}


class ConfigUpdate(BaseModel):
    gmailQuery: Optional[str] = None
    limit: Optional[int] = None


@app.get("/api/settings")
def get_settings():
    config = load_config()
    return {
        "config": {
            "gmailQuery": config.get("gmailQuery") or DEFAULT_QUERY,
            "limit": config.get("limit") or 10,
        },
        "env": _env_status(),
    }


@app.post("/api/settings")
def update_settings(update: ConfigUpdate):
    current = load_config()
    query = (update.gmailQuery or "").strip() or DEFAULT_QUERY
    limit = update.limit if update.limit and update.limit > 0 else current.get("limit") or 10
    next_config = {"gmailQuery": query, "limit": limit}
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(next_config, f, indent=2)
    return {"config": next_config}


def _env_status():
    return {
        "OPENAI_API_KEY": bool(os.environ.get("OPENAI_API_KEY")),
        "GMAIL_CREDENTIALS_FILE": Path(CREDENTIALS_PATH).exists(),
    }


# In-memory state for the background OAuth thread - a single-user local dev
# server doesn't need anything heavier than this.
_gmail_auth_state = {"busy": False, "message": None, "error": None}


@app.get("/api/gmail-auth")
def gmail_auth_status():
    return {
        "connected": Path(TOKEN_PATH).exists(),
        "hasCredentials": Path(CREDENTIALS_PATH).exists(),
        "busy": _gmail_auth_state["busy"],
        "message": _gmail_auth_state["message"],
        "error": _gmail_auth_state["error"],
    }


def _run_gmail_auth():
    _gmail_auth_state.update(busy=True, message=None, error=None)
    try:
        _get_service()
        _gmail_auth_state.update(busy=False, message="Connected.")
    except Exception as err:  # noqa: BLE001 - surface any auth failure to the UI
        _gmail_auth_state.update(busy=False, error=str(err))


@app.post("/api/gmail-auth")
def gmail_auth_start():
    if not Path(CREDENTIALS_PATH).exists():
        raise HTTPException(
            400,
            "credentials.json not found at the repo root. Download your OAuth "
            "client secret from Google Cloud Console first.",
        )
    if Path(TOKEN_PATH).exists():
        return {"status": "already_connected"}
    if _gmail_auth_state["busy"]:
        return {"status": "already_running"}
    threading.Thread(target=_run_gmail_auth, daemon=True).start()
    return {
        "status": "started",
        "message": "A browser window should open — sign in and approve access, "
        "then this page will update automatically.",
    }
