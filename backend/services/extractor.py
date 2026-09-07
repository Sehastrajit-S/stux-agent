import json
import os

from openai import OpenAI

MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

SYSTEM_PROMPT = """You are a task-and-course extraction assistant. You will be given the \
text of a single email. Decide whether it contains an actionable task \
(an assignment, deadline, or to-do) or a course-related announcement (course name/code, \
meeting time, registration, office hours), or neither.

Respond with ONLY a JSON object, no other text, matching this schema exactly:
{
  "is_relevant": true or false,
  "type": "task" | "course" | "both" | "none",
  "title": short string summarizing what this actually is, or null,
  "course_code": string like "CSE598" if one is mentioned, or null,
  "due_date": "YYYY-MM-DD" if a date is stated or clearly implied, or null,
  "priority": "high" | "medium" | "low" | null,
  "overview": if is_relevant is true, one short sentence stating plainly what this
    is (e.g. "Presentation slot sign-up for CSE598" or "Exam date for CSE511").
    If is_relevant is false, one short sentence explaining why it was skipped.
  "steps": if is_relevant is true, a list of short, concrete checklist items for
    what the reader needs to do - each one an action ("Sign up on the linked Google
    Sheet by Sept 8", "Submit via Canvas", "Bring a calculator to the exam"), not a
    restatement of the email. Empty list if nothing actionable beyond being aware of
    it (e.g. a pure FYI or a posted grade). If is_relevant is false, empty list.
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
        f"From: {message.get('sender', 'unknown')}\n"
        f"Subject: {message.get('subject', '')}\n"
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
            "overview": f"Could not parse model output: {raw[:200]}",
            "steps": [],
        }

    # Defensive: don't let a malformed model response (wrong type, missing
    # key) break downstream code that assumes `steps` is always a list.
    steps = parsed.get("steps")
    parsed["steps"] = steps if isinstance(steps, list) else []

    parsed["source"] = message["source"]
    parsed["source_id"] = message.get("id")
    parsed["sender"] = message.get("sender")
    parsed["subject"] = message.get("subject")
    parsed["received_at"] = message.get("received_at")
    return parsed
