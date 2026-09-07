import threading
from pathlib import Path

from fastapi import APIRouter, HTTPException

from gmail_client import CREDENTIALS_PATH, TOKEN_PATH, _get_service

router = APIRouter(prefix="/api", tags=["gmail"])

# In-memory state for the background OAuth thread - a single-user local dev
# server doesn't need anything heavier than this.
_state = {"busy": False, "message": None, "error": None}


@router.get("/gmail-auth")
def gmail_auth_status():
    return {
        "connected": Path(TOKEN_PATH).exists(),
        "hasCredentials": Path(CREDENTIALS_PATH).exists(),
        "busy": _state["busy"],
        "message": _state["message"],
        "error": _state["error"],
    }


def _run_gmail_auth():
    _state.update(busy=True, message=None, error=None)
    try:
        _get_service()
        _state.update(busy=False, message="Connected.")
    except Exception as err:  # noqa: BLE001 - surface any auth failure to the UI
        _state.update(busy=False, error=str(err))


@router.post("/gmail-auth")
def gmail_auth_start():
    if not Path(CREDENTIALS_PATH).exists():
        raise HTTPException(
            400,
            "credentials.json not found at the repo root. Download your OAuth "
            "client secret from Google Cloud Console first.",
        )
    if Path(TOKEN_PATH).exists():
        return {"status": "already_connected"}
    if _state["busy"]:
        return {"status": "already_running"}
    threading.Thread(target=_run_gmail_auth, daemon=True).start()
    return {
        "status": "started",
        "message": "A browser window should open — sign in and approve access, "
        "then this page will update automatically.",
    }
