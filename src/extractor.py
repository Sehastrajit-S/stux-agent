import json
import os

from openai import OpenAI

MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

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
  "summary": if is_relevant is true, a 2-4 sentence practical overview of what the
    reader actually needs to do - restate any specific dates/times mentioned, name
    any form, sign-up sheet, or link that was referenced, and spell out the concrete
    next step(s) (e.g. "sign up for a presentation slot", "submit via Canvas by the
    deadline"). If nothing actionable is required beyond reading it, say so briefly.
    If is_relevant is false, one short sentence explaining why it was skipped.
}"""


def _strip_code_fence(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    return raw.strip()


def extract(message: dict) -> dict:
    """Run a single OpenAI call to classify + extract structured fields from one message."""
    client = OpenAI()
    user_content = (
        f"Source: {message['source']}\n"
        f"From: {message.get('sender', 'unknown')}\n"
        f"Subject/Channel: {message.get('subject', message.get('channel', ''))}\n"
        f"Text:\n{message['text']}"
    )
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=550,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    )
    raw = _strip_code_fence(response.choices[0].message.content)
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
    parsed["sender"] = message.get("sender")
    parsed["subject"] = message.get("subject", message.get("channel"))
    parsed["received_at"] = message.get("received_at")
    return parsed
