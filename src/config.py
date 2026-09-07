import json
from pathlib import Path

CONFIG_PATH = Path(__file__).parent.parent / "config.json"

DEFAULTS = {
    "gmailQuery": None,
    "slackChannelId": None,
    "limit": 10,
}


def load_config() -> dict:
    """Load non-secret settings written by the dashboard's Settings page.

    Falls back to DEFAULTS if config.json is missing or malformed; secrets
    (API keys, tokens) are never stored here, only in .env / credentials.json.
    """
    if not CONFIG_PATH.exists():
        return dict(DEFAULTS)
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return dict(DEFAULTS)
    merged = dict(DEFAULTS)
    merged.update({k: v for k, v in data.items() if v not in (None, "")})
    return merged
