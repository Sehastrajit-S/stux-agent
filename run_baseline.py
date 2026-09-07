import os
import sys
from argparse import ArgumentParser
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "src"))

from pipeline import run, TASKS_PATH, ALL_MESSAGES_PATH  # noqa: E402


def main():
    parser = ArgumentParser(description="Extract tasks and courses from live Gmail messages.")
    parser.add_argument(
        "--limit", type=int, default=None, help="Max messages to fetch (overrides config.json)."
    )
    parser.add_argument(
        "--gmail-query",
        default=None,
        help="Gmail search query (overrides config.json / GMAIL_QUERY; "
        "default 'from:notifications@instructure.com').",
    )
    args = parser.parse_args()

    if "OPENAI_API_KEY" not in os.environ:
        sys.exit("ERROR: set the OPENAI_API_KEY environment variable before running.")

    result = run(limit=args.limit, gmail_query=args.gmail_query)

    print(f"Fetched {result['fetched']} message(s) from Gmail.\n")
    for r in result["all"]:
        flag = "RELEVANT" if r.get("is_relevant") else "skip"
        print(f"[{flag:8}] {r.get('title') or r.get('subject') or '(untitled)'!r}")

    print(
        f"\n{len(result['relevant'])} relevant task(s)/course(s) "
        f"extracted out of {result['fetched']} message(s)."
    )
    print(f"Relevant results written to {TASKS_PATH}")
    print(f"All fetched messages (relevant or not) written to {ALL_MESSAGES_PATH}")
    print(
        "Run the backend + dashboard to view them: "
        "uvicorn backend.main:app --reload (in one terminal), "
        "npm run dev in dashboard/ (in another), then open http://localhost:3000"
    )


if __name__ == "__main__":
    main()
