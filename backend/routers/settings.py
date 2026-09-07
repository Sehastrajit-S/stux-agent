import json
import os
from pathlib import Path

from fastapi import APIRouter

from ..core.config import CONFIG_PATH, load_config
from ..schemas import ConfigUpdate
from ..services.gmail_client import CREDENTIALS_PATH, DEFAULT_QUERY

router = APIRouter(prefix="/api", tags=["settings"])


def _env_status():
    return {
        "OPENAI_API_KEY": bool(os.environ.get("OPENAI_API_KEY")),
        "GMAIL_CREDENTIALS_FILE": Path(CREDENTIALS_PATH).exists(),
    }


@router.get("/settings")
def get_settings():
    config = load_config()
    return {
        "config": {
            "gmailQuery": config.get("gmailQuery") or DEFAULT_QUERY,
            "limit": config.get("limit") or 10,
        },
        "env": _env_status(),
    }


@router.post("/settings")
def update_settings(update: ConfigUpdate):
    current = load_config()
    query = (update.gmailQuery or "").strip() or DEFAULT_QUERY
    limit = update.limit if update.limit and update.limit > 0 else current.get("limit") or 10
    next_config = {"gmailQuery": query, "limit": limit}
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(next_config, f, indent=2)
    return {"config": next_config}
