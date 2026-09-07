import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "src"))

from extractor import extract  # noqa: E402


def load_gmail(max_results: int, query: str) -> list:
    from gmail_client import fetch_recent_emails

    return fetch_recent_emails(max_results, query=query)


def load_slack(channel, limit: int) -> list:
    from slack_client import fetch_recent_messages

    return fetch_recent_messages(channel, limit)


def main():
    parser = argparse.ArgumentParser(
        description="Extract tasks and courses from live Gmail and/or Slack messages."
    )
    parser.add_argument(
        "--source",
        choices=["gmail", "slack", "all"],
        default="all",
        help="Which live source(s) to read from.",
    )
    parser.add_argument("--limit", type=int, default=10, help="Max messages per live source.")
    parser.add_argument(
        "--slack-channel", default=None, help="Slack channel ID (overrides SLACK_CHANNEL_ID)."
    )
    parser.add_argument(
        "--gmail-query",
        default=None,
        help="Gmail search query (overrides GMAIL_QUERY; default 'from:notifications@instructure.com').",
    )
    parser.add_argument(
        "--output", default=str(ROOT / "output" / "tasks_and_courses.json")
    )
    args = parser.parse_args()

    if "OPENAI_API_KEY" not in os.environ:
        sys.exit("ERROR: set the OPENAI_API_KEY environment variable before running.")

    messages = []
    if args.source in ("gmail", "all"):
        messages += load_gmail(args.limit, args.gmail_query)
    if args.source in ("slack", "all"):
        messages += load_slack(args.slack_channel, args.limit)

    print(f"Loaded {len(messages)} message(s) from source='{args.source}'.\n")

    results = []
    for msg in messages:
        result = extract(msg)
        results.append(result)
        flag = "RELEVANT" if result.get("is_relevant") else "skip"
        label = result.get("title") or msg["text"][:60]
        print(f"[{flag:8}] ({result.get('source')}) {label!r}")

    relevant = [r for r in results if r.get("is_relevant")]
    relevant.sort(key=lambda r: r.get("due_date") or "9999-99-99")

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(relevant, f, indent=2)

    print(f"\n{len(relevant)} relevant task(s)/course(s) extracted out of {len(messages)} message(s).")
    print(f"Full results written to {out_path}")
    print("Run the Next.js dashboard (dashboard/) to view them: npm run dev, then open http://localhost:3000")


if __name__ == "__main__":
    main()
