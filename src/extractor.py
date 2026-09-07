import json
import os

from anthropic import Anthropic

MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")

SYSTEM_PROMPT = """You are a task-and-course extraction assistant. You will be given the \
text of a single email or Slack message. Decide whether it contains an actionable task \
(an assignment, deadline, or to-do) or a course-related announcement (course name/code, \
meeting time, registration, office hours), or neither.

Respond with ONLY a JSON object, no other text, matching this schema exactly:
{
  "is_relevant": true or false,
  "type": "task" | "course" | "both" | "none",
  "title": short string summarizing the item, or null,
  "course_code": string like "CSE598" if one is mentioned, or null,
  "due_date": "YYYY-MM-DD" if a date is stated or clearly implied, or null,
  "priority": "high" | "medium" | "low" | null,
  "summary": one sentence explaining why this is or is not relevant
}"""


def _strip_code_fence(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    return raw.strip()


def extract(message: dict) -> dict:
    """Run a single Claude call to classify + extract structured fields from one message."""
    client = Anthropic()
    user_content = (
        f"Source: {message['source']}\n"
        f"From: {message.get('sender', 'unknown')}\n"
        f"Subject/Channel: {message.get('subject', message.get('channel', ''))}\n"
        f"Text:\n{message['text']}"
    )
    response = client.messages.create(
        model=MODEL,
        max_tokens=400,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    raw = _strip_code_fence(response.content[0].text)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {
            "is_relevant": False,
            "type": "none",
            "title": None,
            "course_code": None,
            "due_date": None,
            "priority": None,
            "summary": f"Could not parse model output: {raw[:200]}",
        }
    parsed["source"] = message["source"]
    parsed["source_id"] = message.get("id")
    return parsed
