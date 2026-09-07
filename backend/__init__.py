from pathlib import Path

from dotenv import load_dotenv

# backend/__init__.py -> backend -> repo root
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
