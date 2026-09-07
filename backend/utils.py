import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def iso(mtime: Optional[float]) -> Optional[str]:
    if mtime is None:
        return None
    return datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()


def read_json(path: Path):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data, path.stat().st_mtime, None
    except FileNotFoundError:
        return [], None, "not_found"
    except (json.JSONDecodeError, OSError) as err:
        return [], None, f"read_error: {err}"
