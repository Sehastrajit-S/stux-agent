# Capstone Project Proposal

## Basic Information

| Field | Response |
|---|---|
| Student name | *[fill in]* |
| Project title | Task and Course Extraction Agent for Email and Slack |
| Repository / notebook link | *[fill in after publishing — see below]* |
| Configuration location | `examples/readme.md` |

## Section 1. Problem Definition

**Task.** Given a batch of recent Gmail and Slack messages, identify the ones that
contain an actionable task (an assignment, deadline, or to-do) or a course-related
fact (registration confirmation, meeting time, office-hours change), and extract each
into a structured record. Consolidate all extracted records into a single list, sorted
by due date.

**User.** A graduate student enrolled in multiple courses who receives deadline and
course information scattered across a high-volume Gmail inbox and several Slack
channels (course channels, project teams, advisor DMs), and currently has to read
every message manually to avoid missing something.

**Input.** Raw messages from two sources:
- Gmail: message objects from the Gmail API (`sender`, `subject`, `body`).
- Slack: message objects from `conversations.history` (`sender`, `channel`, `text`).

**Output.** A JSON list of records, each with:
`{ type: "task" | "course", title, course_code, due_date, priority, source, summary }`,
sorted by `due_date`.

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
- Read-only ingestion from Gmail (Gmail API, OAuth2) and Slack (`conversations.history`).
- Per-message LLM-based classification and structured extraction (task vs. course vs.
  neither, title, course code, due date, priority).
- A consolidated, due-date-sorted output list from a single batch fetch.

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
   Gmail, live Slack, or all three.
2. Normalize each message to `{source, sender, subject/channel, text}`.
3. Send each message's text to OpenAI with a fixed system prompt asking for one JSON
   object: `is_relevant`, `type`, `title`, `course_code`, `due_date`, `priority`,
   `summary`.
4. Filter to relevant results, sort by `due_date`.
5. Write the sorted list to `output/tasks_and_courses.json` and print a
   human-readable summary line per message.

**Why this is a reasonable starting point.** It is the simplest system that touches
every piece the target problem needs — real ingestion clients for both sources, and
one LLM call doing the actual judgment and extraction — without yet requiring
multi-step planning, chained tool calls, or persistent memory. It is a genuine
"single-call model baseline" per message, which makes its failure modes easy to
attribute (bad extraction vs. bad ingestion) when building the next phase.

**Files.**
- [`run_baseline.py`](../run_baseline.py) — CLI entry point and orchestration.
- [`src/extractor.py`](../src/extractor.py) — the single OpenAI call.
- [`src/gmail_client.py`](../src/gmail_client.py) — live Gmail ingestion.
- [`src/slack_client.py`](../src/slack_client.py) — live Slack ingestion.
- [`examples/sample_gmail_messages.json`](../examples/sample_gmail_messages.json),
  [`examples/sample_slack_messages.json`](../examples/sample_slack_messages.json) —
  fixtures for the reproducible test case.

## Section 4. Test Case and Baseline Output

**Sample input.** The six bundled fixture messages (three Gmail, three Slack):
1. Gmail — professor's email: CSE598 HW3 deadline extended to 2026-09-12.
2. Gmail — registrar: CSE511 registration confirmation with meeting time.
3. Gmail — LinkedIn newsletter (irrelevant).
4. Slack — advisor reminder: capstone proposal due tonight, Sept 6, 11:59 PM Phoenix.
5. Slack — classmate asking about lunch (irrelevant).
6. Slack — TA: CSE598 office hours moved to Thursdays 2–3pm this week.

**Expected behavior.** Messages 1, 2, 4, and 6 should be flagged `is_relevant: true`
with a reasonable `title` and, where stated, `course_code` and `due_date`. Messages 3
and 5 should be flagged `is_relevant: false`.

**Actual baseline output.** Ran `python run_baseline.py --source sample`:

```
Loaded 6 message(s) from source='sample'.

[RELEVANT] (gmail) 'CSE598 HW3 deadline extension'
[RELEVANT] (gmail) 'CSE511 Data Processing at Scale Registration Confirmation'
[skip    ] (gmail) '5 new jobs match your profile\nCheck out these new job postin'
[RELEVANT] (slack) 'Capstone proposal submission'
[skip    ] (slack) 'anyone want to grab lunch after class today lol'
[RELEVANT] (slack) 'Office Hours Change for CSE598'

4 relevant task(s)/course(s) extracted out of 6 message(s).
Full results written to output/tasks_and_courses.json
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
    "summary": "The message contains a reminder about the due date for the capstone proposal, making it relevant for students in the course.",
    "source": "slack",
    "source_id": "slack-1757195000.000100"
  },
  {
    "is_relevant": true,
    "type": "course",
    "title": "CSE598 HW3 deadline extension",
    "course_code": "CSE598",
    "due_date": "2026-09-12",
    "priority": "medium",
    "summary": "The email contains an announcement about the extension of the deadline for Homework 3 in the CSE598 course.",
    "source": "gmail",
    "source_id": "gmail-001"
  },
  {
    "is_relevant": true,
    "type": "course",
    "title": "CSE511 Data Processing at Scale Registration Confirmation",
    "course_code": "CSE511",
    "due_date": null,
    "priority": null,
    "summary": "The message confirms registration for CSE511, making it an important course-related announcement.",
    "source": "gmail",
    "source_id": "gmail-002"
  },
  {
    "is_relevant": true,
    "type": "course",
    "title": "Office Hours Change for CSE598",
    "course_code": "CSE598",
    "due_date": null,
    "priority": null,
    "summary": "The message provides a course-related announcement regarding a temporary change in office hours.",
    "source": "slack",
    "source_id": "slack-1757195200.000300"
  }
]
```

*[Paste a screenshot of this terminal run here before submitting to Canvas.]*

**What worked.** Relevance classification was perfect on all 6 messages: both
irrelevant messages (the LinkedIn newsletter, the lunch small talk) were correctly
skipped, and all 4 relevant messages (a homework extension, a registration
confirmation, a proposal-deadline reminder, and an office-hours change) were
correctly flagged, with the right `course_code` attached to each.

**What did not work.** Two concrete failures, both consistent with the limitation
already anticipated in Section 7 (the model isn't given the message's actual
timestamp): (1) the Slack reminder said only "today, September 6" with no year — the
model filled in `due_date: "2023-09-06"`, guessing the wrong year instead of leaving
it null or inferring the current year, a hallucination risk. (2) the HW3 extension
message was typed `"course"` rather than `"task"`/`"both"`, even though it states an
actionable deadline — the type field is not fully reliable and would need either a
stricter schema/enum guard or a second pass before being trusted downstream.

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

**Output location.** `output/tasks_and_courses.json`, plus a printed summary on
stdout.

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
