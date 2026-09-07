# Capstone Project Proposal

## Basic Information

| Field | Response |
|---|---|
| Student name | *[fill in]* |
| Project title | Task and Course Extraction Agent for Email and Slack |
| Repository / notebook link | *[fill in after publishing — see below]* |
| Configuration location | `examples/readme.md` |

## Section 1. Problem Definition

**Task.** Given a batch of recent Canvas (Instructure) notification emails and Slack
messages, identify the ones that contain an actionable task (an assignment, deadline,
or to-do) or a course-related fact (enrollment confirmation, meeting time,
office-hours change), and extract each into a structured record. Consolidate all
extracted records into a single list, sorted by due date, and present it both as JSON
and as a browsable dashboard.

**User.** A graduate student enrolled in multiple courses who receives deadline and
course information scattered across Canvas notification emails and several Slack
channels (course channels, project teams, advisor DMs), and currently has to read
every message manually to avoid missing something.

**Input.** Raw messages from two sources:
- Gmail: message objects from the Gmail API, filtered to `from:notifications@instructure.com`
  (`sender`, `subject`, `body`) — i.e. only Canvas notification emails, not the whole inbox.
- Slack: message objects from `conversations.history` (`sender`, `channel`, `text`).

**Output.** A JSON list of records, each with:
`{ type: "task" | "course", title, course_code, due_date, priority, source, summary }`,
sorted by `due_date`, plus a self-contained HTML dashboard (`output/dashboard.html`)
showing the same records as filterable cards with due-date status (overdue / due soon
/ later).

**Success / failure.** For a message that states or clearly implies a deadline or
course fact:
- **Success**: the system flags it as relevant and produces an accurate title, and
  (when present in the text) an accurate `course_code` and `due_date`.
- **Failure**: the system misses a message that contains an actionable deadline (false
  negative), invents a due date or course code not present in the text (hallucination /
  false positive), flags an irrelevant message (newsletter, small talk) as relevant, or
  crashes on a malformed message instead of skipping it.

## Section 2. Motivation and Project Scope

**Why it matters.** Deadline and course information is buried in high-volume,
low-signal channels — registrar emails sit next to newsletters, and a TA's
office-hours change sits next to unrelated banter in the same Slack channel. Manually
triaging this daily is tedious and error-prone, and missing a single message can mean
missing a deadline.

**Why an agentic AI approach is reasonable.** The input is unstructured natural
language with wide variation in phrasing, sender, and format — a fixed regex or
keyword list cannot generalize across a registrar confirmation, a professor's email,
and a TA's Slack message. An LLM can judge relevance and extract structured fields
from arbitrary phrasing in one call. Framing this as an *agentic* system (rather than
a static classifier) also matters for where the project goes next: later phases add
tool use (reading live inboxes/channels), and eventually actions (creating calendar
events, sending reminders) — this baseline is the perception/extraction step that
those future actions depend on.

**In scope this semester.**
- Read-only ingestion from Gmail, scoped to Canvas/Instructure notification emails
  (Gmail API, OAuth2, search-filtered) and Slack (`conversations.history`).
- Per-message LLM-based classification and structured extraction (task vs. course vs.
  neither, title, course code, due date, priority).
- A consolidated, due-date-sorted output list from a single batch fetch, viewable as
  JSON or as a local HTML dashboard.

**Out of scope this semester.**
- Writing back to a calendar or to-do app.
- Multi-turn clarification with the user when a message is ambiguous.
- Cross-referencing extracted courses/deadlines against an official syllabus or LMS.
- Deduplication or memory across multiple runs / days of history (the baseline
  processes one batch per run, independently).

## Section 3. Runnable Baseline

**What it uses.** The OpenAI API (single call per message, model
`gpt-4o-mini` by default) for extraction; the Gmail API
(`google-api-python-client`, OAuth2) and the Slack Web API (`slack_sdk`) for live
ingestion; a bundled pair of JSON fixture files for the default, credential-free
reproducible run.

**What it does, step by step.**
1. Load messages from the chosen `--source`: bundled sample fixtures (default), live
   Gmail (filtered to Canvas/Instructure notifications by default), live Slack, or all
   three.
2. Normalize each message to `{source, sender, subject/channel, text}`.
3. Send each message's text to OpenAI with a fixed system prompt asking for one JSON
   object: `is_relevant`, `type`, `title`, `course_code`, `due_date`, `priority`,
   `summary`.
4. Filter to relevant results, sort by `due_date`.
5. Write the sorted list to `output/tasks_and_courses.json`, print a human-readable
   summary line per message, and render `output/dashboard.html` — a self-contained
   page (data embedded, no server) with stat counts and filterable, due-date-colored
   cards.

**Why this is a reasonable starting point.** It is the simplest system that touches
every piece the target problem needs — real ingestion clients for both sources, and
one LLM call doing the actual judgment and extraction — without yet requiring
multi-step planning, chained tool calls, or persistent memory. It is a genuine
"single-call model baseline" per message, which makes its failure modes easy to
attribute (bad extraction vs. bad ingestion) when building the next phase.

**Files.**
- [`run_baseline.py`](../run_baseline.py) — CLI entry point and orchestration.
- [`src/extractor.py`](../src/extractor.py) — the single OpenAI call.
- [`src/gmail_client.py`](../src/gmail_client.py) — live Gmail ingestion, search-filtered
  to `from:notifications@instructure.com` by default.
- [`src/slack_client.py`](../src/slack_client.py) — live Slack ingestion.
- [`src/dashboard.py`](../src/dashboard.py) — renders extracted records as a
  self-contained HTML dashboard.
- [`examples/sample_gmail_messages.json`](../examples/sample_gmail_messages.json),
  [`examples/sample_slack_messages.json`](../examples/sample_slack_messages.json) —
  fixtures for the reproducible test case.

## Section 4. Test Case and Baseline Output

**Sample input.** The seven bundled fixture messages (four Gmail — all styled as real
Canvas/Instructure notification emails, since that's the exact live filter used —
three Slack):
1. Gmail — Canvas: "Assignment Due Soon: Homework 3", CSE 598, due 2026-09-12.
2. Gmail — Canvas: "New Announcement" — CSE 598 office hours moved to Thursday 2–3pm.
3. Gmail — Canvas: "Grade Posted: Homework 2" (informational, not a task/course fact
   worth tracking — irrelevant).
4. Gmail — Canvas: "Enrollment Confirmation: CSE 511" with meeting time.
5. Slack — advisor reminder: capstone proposal due tonight, Sept 6, 11:59 PM Phoenix.
6. Slack — classmate asking about lunch (irrelevant).
7. Slack — TA: CSE598 office hours moved to Thursdays 2–3pm this week.

**Expected behavior.** Messages 1, 2, 4, 5, and 7 should be flagged `is_relevant:
true` with a reasonable `title` and, where stated, `course_code` and `due_date`.
Messages 3 and 6 should be flagged `is_relevant: false`.

**Actual baseline output.** Ran `python run_baseline.py --source sample`:

```
Loaded 7 message(s) from source='sample'.

[RELEVANT] (gmail) 'Homework 3 Due Soon'
[RELEVANT] (gmail) 'Office Hours Moved'
[skip    ] (gmail) 'Grade Posted: Homework 2\nCSE 598: Agentic AI Systems\nYour gr'
[RELEVANT] (gmail) 'Enrollment Confirmation for CSE 511'
[RELEVANT] (slack) 'Capstone proposal submission'
[skip    ] (slack) 'anyone want to grab lunch after class today lol'
[RELEVANT] (slack) 'Change in Office Hours for CSE598'

5 relevant task(s)/course(s) extracted out of 7 message(s).
Full results written to output/tasks_and_courses.json
Dashboard written to output/dashboard.html (open it in a browser)
```

`output/tasks_and_courses.json` (sorted by `due_date`):

```json
[
  {
    "is_relevant": true,
    "type": "task",
    "title": "Capstone proposal submission",
    "course_code": "CSE598",
    "due_date": "2023-09-06",
    "priority": "high",
    "summary": "The message includes a task to submit the capstone proposal by a specified deadline.",
    "source": "slack",
    "source_id": "slack-1757195000.000100"
  },
  {
    "is_relevant": true,
    "type": "task",
    "title": "Homework 3 Due Soon",
    "course_code": "CSE598",
    "due_date": "2026-09-12",
    "priority": "high",
    "summary": "This email contains a task regarding the due date for Homework 3 in the CSE 598 course.",
    "source": "gmail",
    "source_id": "gmail-001"
  },
  {
    "is_relevant": true,
    "type": "course",
    "title": "Office Hours Moved",
    "course_code": "CSE598",
    "due_date": null,
    "priority": null,
    "summary": "The message informs about a change in office hours for the CSE 598 course.",
    "source": "gmail",
    "source_id": "gmail-002"
  },
  {
    "is_relevant": true,
    "type": "course",
    "title": "Enrollment Confirmation for CSE 511",
    "course_code": "CSE511",
    "due_date": null,
    "priority": null,
    "summary": "The message confirms enrollment in a course, providing specific details about the course schedule.",
    "source": "gmail",
    "source_id": "gmail-004"
  },
  {
    "is_relevant": true,
    "type": "course",
    "title": "Change in Office Hours for CSE598",
    "course_code": "CSE598",
    "due_date": null,
    "priority": "low",
    "summary": "The message announces a temporary change in office hours for a specific course.",
    "source": "slack",
    "source_id": "slack-1757195200.000300"
  }
]
```

Plus `output/dashboard.html`: a card grid with stat counts (Total / Tasks / Courses /
Overdue / Due ≤ 7d) and filter chips for All / Tasks / Courses / Gmail / Slack.

*[Paste a screenshot of this terminal run and the dashboard page here before
submitting to Canvas.]*

**What worked.** Relevance classification was perfect on all 7 messages: both
irrelevant messages (the grade-posted notification, the lunch small talk) were
correctly skipped, and all 5 relevant messages (a homework deadline, an
office-hours-change email, an enrollment confirmation, a proposal-deadline reminder,
and a duplicate office-hours-change Slack message) were correctly flagged, with the
right `course_code` attached to each.

**What did not work.** Three concrete failures:
1. The Slack reminder said only "today, September 6" with no year — the model filled
   in `due_date: "2023-09-06"`, guessing the wrong year instead of leaving it null or
   inferring the current year from context, a hallucination risk. This is consistent
   with the limitation anticipated in Section 7 (the model isn't given the message's
   actual timestamp).
2. Messages 2 (Gmail) and 7 (Slack) both describe the same real-world event — CSE598
   office hours moving — but arrive as two separate, undeduplicated records in the
   output, exactly the "no deduplication across sources" weakness called out in
   Section 7.
3. Re-running the identical command produced a different `type` for the HW3 message
   across two runs (`"course"` on one run, `"task"` on another, for effectively the
   same input) — the single-call classification is not fully deterministic even at
   the schema level, which the evaluation plan (Section 6) will need to account for
   (e.g. by running each labeled example multiple times).

## Section 5. Reproducibility and Run Instructions

**Dependencies.** Python 3.10+; see [`requirements.txt`](../requirements.txt)
(`openai`, `python-dotenv`, `google-api-python-client`, `google-auth-httplib2`,
`google-auth-oauthlib`, `slack_sdk`).

**Install.**
```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

**Required environment variables.** Only `OPENAI_API_KEY` is required for the
reproducible test case below. Gmail/Slack credentials are only needed for the
optional live-source modes. Full reference in
[`examples/readme.md`](../examples/readme.md).

**Exact command to run the baseline / test case:**
```bash
python run_baseline.py --source sample
```

**Input location.** `examples/sample_gmail_messages.json`,
`examples/sample_slack_messages.json`.

**Output location.** `output/tasks_and_courses.json`, `output/dashboard.html` (open
directly in a browser, no server needed), plus a printed summary on stdout.

**Known setup limitations.** Live Gmail auth opens a browser for OAuth consent (won't
work headless without port forwarding); the Slack bot must be invited to its target
channel before `conversations.history` can read it; neither is needed to reproduce
the test case in Section 4.

## Section 6. Initial Evaluation Plan

To compare a future, improved system against this baseline, I will use a small
hand-labeled set of real (or realistic synthetic) messages and measure:

- **Precision / recall on relevance**: of the messages the system flags relevant, how
  many actually are (precision), and of the messages that actually are relevant, how
  many did it catch (recall) — recall matters most, since a missed deadline is the
  costly failure mode.
- **Field accuracy**: for correctly flagged messages, whether `course_code` and
  `due_date` match the ground truth exactly (or are null when the text doesn't state
  one, to catch hallucination).
- **Latency and cost per message**: wall-clock time and token cost of the single
  OpenAI call, as a baseline to compare against a more complex (multi-call, tool-use)
  future system.
- **Tool failure rate**: how often the Gmail/Slack clients or the JSON parse step
  fail, as ingestion reliability matters independently of extraction quality.

This baseline does not yet have an evaluation harness; the next phase will add a
labeled test set and a script that computes these metrics automatically.

## Section 7. Limitations and Next Steps

**Known weaknesses.**
- No deduplication across overlapping emails/Slack threads (a reminder email and a
  Slack ping about the same deadline become two separate records).
- Relative dates ("next Friday", "this week") are left to the model to resolve without
  being given the message's actual timestamp, which risks incorrect absolute dates.
- A message that fails JSON parsing is silently treated as irrelevant rather than
  retried or flagged for review.
- English-only prompt; no evaluation yet of non-English messages.
- No write-back (calendar, to-do list) — the system only observes, it does not act.
- Classification is not fully deterministic run-to-run (observed directly in Section 4:
  the same HW3 message was typed `"course"` on one run and `"task"` on another).

**Expected failure cases.** Messages that mention a date unrelated to a deadline
(e.g., "the meeting last Tuesday"), ambiguous course references without an explicit
code, and long email threads where the actionable content is buried under quoted
reply history.

**Next phase.** Pass message timestamps into the extraction prompt so relative dates
resolve correctly; add deduplication across sources; build the labeled evaluation set
and metrics script described in Section 6; add an optional write-back step (create a
calendar event or Slack reminder) gated behind user confirmation.

**Risks.** API rate limits/cost if scaled to a full inbox history; Gmail/Slack API
quota and OAuth app verification requirements if this needs to run for users other
than the developer.

**Help / infrastructure needed.** None beyond a personal OpenAI API key, a Google
Cloud project with the Gmail API enabled, and a Slack app/bot token for testing.
