"""Standalone entry point for the Gmail OAuth consent flow.

Triggered from the dashboard's Settings page (via a spawned subprocess) so a
user can connect Gmail with a button click instead of running a CLI command.
Reuses gmail_client._get_service(), the same auth code run_baseline.py uses,
so there is one source of truth for how token.json gets written.
"""
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).parent))

from gmail_client import _get_service  # noqa: E402

if __name__ == "__main__":
    try:
        _get_service()
        print("GMAIL_AUTH_OK")
    except Exception as err:  # noqa: BLE001 - report to the log the API route reads
        print(f"GMAIL_AUTH_ERROR: {err}")
        sys.exit(1)
