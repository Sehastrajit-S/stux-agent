import sys
from pathlib import Path

from dotenv import load_dotenv

# src/backend/__init__.py -> backend -> src -> repo root
SRC_DIR = Path(__file__).resolve().parent.parent
ROOT = SRC_DIR.parent

load_dotenv(ROOT / ".env")

# The sibling modules (config, gmail_client, extractor, pipeline, gmail_login)
# are plain top-level modules, not a package, so every submodule under
# src/backend/ needs SRC_DIR on sys.path before it can `import pipeline` etc.
# Runs here, once, since Python always initializes a parent package (this
# file) before any of its submodules (main.py, routers/*.py).
sys.path.insert(0, str(SRC_DIR))
