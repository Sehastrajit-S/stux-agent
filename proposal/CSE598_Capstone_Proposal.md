# Capstone Project Proposal

## Basic Information

| Field | Response |
|---|---|
| Student name | *[fill in]* |
| Project title | Task and Course Extraction Agent for Email |
| Repository / notebook link | *[fill in after publishing — see below]* |
| Configuration location | `examples/readme.md` |

## Section 1. Problem Definition

**Task.** Given a batch of recent Canvas (Instructure) notification emails, identify
the ones that contain an actionable task (an assignment, deadline, or to-do) or a
course-related fact (enrollment confirmation, meeting time, office-hours change), and
extract each into a structured record with a practical overview of what to actually
do. Consolidate all extracted records into a single list, sorted by due date, and
present it both as JSON and as a browsable dashboard.

**User.** A graduate student enrolled in multiple courses who receives deadline and
course information scattered across Canvas notification emails, and currently has to
read every message manually to avoid missing something.

**Input.** Raw messages from the Gmail API, filtered to
`from:notifications@instructure.com` (`sender`, `subject`, `body`) — i.e. only Canvas
notification emails, not the whole inbox.

**Output.** A JSON list of records, each with:
`{ type: "task" | "course", title, course_code, due_date, priority, summary, source }`,
sorted by `due_date`, plus a Next.js dashboard (`dashboard/`) that reads that JSON file
and renders it as filterable cards with due-date status (overdue / due soon / later),
a calendar, and a per-day overview.

**Success / failure.** For a message that states or clearly implies a deadline or
course fact:
- **Success**: the system flags it as relevant, produces an accurate title, and
  (when present in the text) an accurate `course_code` and `due_date`, plus a summary
  that names the concrete next step (what to sign up for, what form/link was given,
  what's due when).
- **Failure**: the system misses a message that contains an actionable deadline (false
  negative), invents a due date or course code not present in the text (hallucination /
  false positive), flags an irrelevant message (e.g. a grade-posted notification) as
  relevant, or crashes on a malformed message instead of skipping it.

## Section 2. Motivation and Project Scope

**Why it matters.** Deadline and course information arrives as a stream of
individually-innocuous Canvas emails — a sign-up sheet here, a grade notification
there, an announcement buried in a long thread — and reading each one closely enough
to extract "what do I actually need to do and by when" is tedious and easy to get
wrong under volume.

**Why an agentic AI approach is reasonable.** The input is unstructured natural
language with wide variation in phrasing and format across assignment reminders,
announcements, and enrollment confirmations — a fixed regex or keyword list cannot
reliably tell "sign up for a presentation slot by Friday" apart from "your grade has
been posted." An LLM can judge relevance and extract structured fields *and* a
concrete action summary from arbitrary phrasing in one call. Framing this as an
*agentic* system (rather than a static classifier) also matters for where the project
goes next: later phases add tool use (checking a linked form's status, writing to a
calendar), and this baseline is the perception/extraction step those future actions
depend on.

**In scope this semester.**
- Read-only ingestion from Gmail, scoped to Canvas/Instructure notification emails
  (Gmail API, OAuth2, search-filtered).
- Per-message LLM-based classification and structured extraction (task vs. course vs.
  neither, title, course code, due date, priority, actionable summary).
- A consolidated, due-date-sorted output list from a single batch fetch, viewable as
  JSON or in a live-updating Next.js dashboard (cards, calendar, day overview).

**Out of scope this semester.**
- Writing back to a calendar or to-do app.
- Multi-turn clarification with the user when a message is ambiguous.
- Cross-referencing extracted courses/deadlines against an official syllabus or LMS.
- Deduplication or memory across multiple runs / days of history (the baseline
  processes one batch per run, independently).
- Non-Gmail sources — an earlier version of this project also ingested Slack, but that
  was cut to keep the baseline's scope concrete and its reproducibility story simple
  (see Section 7 for why, and what would be involved in adding a second source back).

## Section 3. Runnable Baseline

**What it uses.** The OpenAI API (single call per message, model `gpt-4o-mini` by
default) for extraction; the Gmail API (`google-api-python-client`, OAuth2) for live
ingestion; a FastAPI backend and a Next.js frontend for the dashboard. There is no
bundled sample/offline data — every run reads the requester's actual Gmail inbox.

**What it does, step by step.**
1. Load recent messages from Gmail, filtered by a search query
   (`from:notifications@instructure.com` by default).
2. Normalize each message to `{source, sender, subject, text, received_at}`.
3. Send each message's text to OpenAI with a fixed system prompt asking for one JSON
   object: `is_relevant`, `type`, `title`, `course_code`, `due_date`, `priority`, and
   `summary` — a 2-4 sentence practical overview (specific dates, any
   form/sign-up-sheet/link referenced, the concrete next step) rather than a generic
   one-line relevance justification.
4. Filter to relevant results, sort by `due_date`.
5. Write the sorted list to `output/tasks_and_courses.json`, and every fetched
   message (relevant or not) to `output/all_messages.json`, printing a
   human-readable summary line per message.
6. Steps 1-5 live in `src/pipeline.py` and are shared by two callers: the
   `run_baseline.py` CLI, and a FastAPI backend (`backend/main.py`) that exposes them
   as a small JSON API (`GET /api/tasks`, `GET /api/messages`, `POST /api/run`, plus
   settings and Gmail-connection endpoints). The Next.js frontend (`dashboard/`) has
   no filesystem or Gmail/OpenAI access of its own — it only calls that API — and
   renders filterable, due-date-colored cards, a month/week/day calendar built from
   the due dates, and a "Day overview" panel showing every message tied to whichever
   day is selected, polling every 8 seconds so it stays in sync with the latest run.

**Why this is a reasonable starting point.** It is the simplest system that touches
every piece the target problem needs — a real ingestion client, and one LLM call
doing the actual judgment, extraction, and action-summary generation — without yet
requiring multi-step planning, chained tool calls, or persistent memory. It is a
genuine "single-call model baseline" per message, which makes its failure modes easy
to attribute (bad extraction vs. bad ingestion) when building the next phase.

**Files.**
- [`run_baseline.py`](../run_baseline.py) — CLI entry point, thin wrapper over the
  shared pipeline.
- [`src/pipeline.py`](../src/pipeline.py) — the actual fetch → extract → write logic,
  called by both the CLI and the API (one implementation, not two copies to keep in
  sync).
- [`backend/main.py`](../backend/main.py) — FastAPI app exposing that pipeline, plus
  settings and Gmail-connection state, as a JSON API for the frontend.
- [`src/extractor.py`](../src/extractor.py) — the single OpenAI call.
- [`src/gmail_client.py`](../src/gmail_client.py) — live Gmail ingestion, search-filtered
  to `from:notifications@instructure.com` by default.
- [`src/gmail_login.py`](../src/gmail_login.py) — standalone OAuth consent flow; the
  backend runs it in a background thread for the dashboard's "Connect Gmail" button.
- [`src/config.py`](../src/config.py) — reads `config.json` (gitignored local state,
  like `.env`; both the CLI and the backend fall back to safe hardcoded defaults if
  it doesn't exist) for non-secret settings shared between them.
- [`dashboard/pages/index.js`](../dashboard/pages/index.js),
  [`dashboard/lib/api.js`](../dashboard/lib/api.js) — the dashboard and the HTTP
  client it uses to call the FastAPI backend (`dashboard/` has no API routes or
  filesystem access of its own).
- [`dashboard/pages/settings.js`](../dashboard/pages/settings.js) — Settings page
  (gear icon, top right) that edits `config.json`, reports whether required secrets
  are present without ever displaying their values, triggers a pipeline run, and can
  run the Gmail OAuth flow — all via calls to the backend.

## Section 4. Test Case and Baseline Output

**Sample input.** A live pull from the student's own Gmail inbox
(`from:notifications@instructure.com`), via:
```bash
python run_baseline.py --limit 15
```
This requires completing an interactive OAuth consent screen in a browser the first
time it runs (see Section 5) — this cannot be scripted or faked, so the test case
below reflects a real run against a real Canvas-enrolled Gmail account, not synthetic
data.

**Expected behavior.** Canvas notification emails that state an assignment deadline,
a sign-up requirement, or an enrollment/meeting-time fact should be flagged
`is_relevant: true` with a reasonable `title`, a `summary` that names the concrete
next step, and, where stated, `course_code` and `due_date`. Purely informational
notifications (e.g. a posted grade with no further action) should be flagged
`is_relevant: false`.

**Actual baseline output.** Ran `python run_baseline.py --limit 15` against a real
Canvas-enrolled Gmail account: fetched 10 messages, all 10 flagged relevant (this
account's recent Canvas activity happened to be entirely actionable — HW reminders,
sign-ups, and grade notices with follow-up steps). Representative excerpts from
`output/all_messages.json`:

```json
{
  "is_relevant": true,
  "type": "both",
  "title": "Upcoming Assignments for CSE 598",
  "course_code": "CSE598",
  "due_date": null,
  "priority": null,
  "summary": "You have multiple assignments due in CSE 598. The 'Code Reading 1: Agent Loop' is due on Sep 15 at 11:59pm, and the 'Project Proposal' is due on Sep 20 at 11:59pm. Please check the links provided for more details on each assignment.",
  "source": "gmail",
  "subject": "Upcoming Assignments for CSE 598"
}
```
```json
{
  "is_relevant": true,
  "type": "course",
  "title": "CSE 598: Presentation and Project Instructions",
  "course_code": "CSE598",
  "due_date": "2026-09-08",
  "priority": "high",
  "summary": "Students must review the individual presentation and group project instructions provided in the links. Sign up for individual presentation slots by September 8 on the provided Google Sheet. For the group project, students can self-sign up their groups in Canvas. Participation in short quizzes is also required.",
  "source": "gmail",
  "subject": "CSE 598: Presentation and Project Instructions"
}
```
```json
{
  "is_relevant": true,
  "type": "task",
  "title": "Review Graded Assignment",
  "course_code": "CSE598",
  "due_date": null,
  "priority": null,
  "summary": "Your assignment titled 'Formulating Agent' has been graded. You can review your graded assignment using the link provided.",
  "source": "gmail",
  "subject": "Review Graded Assignment"
}
```

*[Paste a screenshot of the terminal run and the dashboard (`uvicorn backend.main:app
--reload` in one terminal, `npm run dev` in `dashboard/` in another, then
http://localhost:3000 — cards, calendar, and Day overview) here before submitting to
Canvas.]*

**What worked.** The `summary` field is now genuinely actionable rather than a
generic relevance justification: it correctly surfaced the specific due dates for two
separate assignments in one email, named the exact mechanism ("the provided Google
Sheet") for the presentation sign-up, and distinguished "assignment graded, here's the
link" from "assignment due, here's the deadline." Relevance classification was
accurate for every message in this run.

**What did not work.** Two things worth noting: (1) `due_date` was left `null` for
the first example above even though the summary text clearly states two dates ("Sep
15", "Sep 20") — the model extracted the correct dates into the summary but didn't
promote either into the structured `due_date` field, since the schema only has room
for one date and the message has two; a message with multiple deadlines needs either
a list-valued `due_date` or a decision rule (earliest? soonest-still-relevant?) for
which one wins. (2) With every message in this run correctly flagged relevant, this
particular sample doesn't exercise the false-positive path — the earlier Section 7
finding (a Slack-message date parsed with a hallucinated wrong year) is still the
best documented evidence of that failure mode; see git history (`5e0fb2c`) for that
transcript.

## Section 5. Reproducibility and Run Instructions

**Dependencies.** Python 3.10+ and Node 18+; see [`requirements.txt`](../requirements.txt)
(`openai`, `python-dotenv`, `google-api-python-client`, `google-auth-httplib2`,
`google-auth-oauthlib`, `fastapi`, `uvicorn`) and
[`dashboard/package.json`](../dashboard/package.json) (`next`, `react`, `react-dom`).

**Install.**
```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # fill in OPENAI_API_KEY + Gmail credentials
cd dashboard && npm install && cd ..
```

**Required environment variables.** `OPENAI_API_KEY` and Gmail credentials
(`GMAIL_CREDENTIALS_PATH`, `GMAIL_TOKEN_PATH`) are required for every run, since there
is no offline/sample mode. Full reference in [`examples/readme.md`](../examples/readme.md).

**Exact commands to run the baseline and view it:**
```bash
python run_baseline.py --limit 15
```
or, via the API/dashboard (two terminals):
```bash
uvicorn backend.main:app --reload --port 8000
cd dashboard && npm run dev   # then open http://localhost:3000
```

**Input location.** Live Gmail inbox (via the Gmail API) — not a file in the repo.

**Output location.** `output/tasks_and_courses.json` and `output/all_messages.json`,
plus a printed summary on stdout; the backend's `GET /api/tasks` / `GET /api/messages`
serve those same files to the dashboard at `http://localhost:3000`.

**Known setup limitations.** Live Gmail auth opens a browser for OAuth consent — a
person must click through it once (won't work headless without port forwarding),
either via the terminal on first run or the "Connect Gmail" button on the dashboard's
Settings page (which asks the backend to run it). The backend and dashboard are two
separate processes that must both be running for the dashboard to work. Because there
is no bundled sample data, a grader without the student's own Gmail access cannot
literally reproduce the exact same output — they can verify the code runs correctly
against their *own* Gmail (the `from:notifications@instructure.com` filter works for
any Canvas account), and should otherwise rely on the pasted output/screenshot in
Section 4 as evidence.

## Section 6. Initial Evaluation Plan

To compare a future, improved system against this baseline, I will use a small
hand-labeled set of real (or realistic synthetic) messages and measure:

- **Precision / recall on relevance**: of the messages the system flags relevant, how
  many actually are (precision), and of the messages that actually are relevant, how
  many did it catch (recall) — recall matters most, since a missed deadline is the
  costly failure mode.
- **Field accuracy**: for correctly flagged messages, whether `course_code` and
  `due_date` match the ground truth exactly (or are null when the text doesn't state
  one, to catch hallucination) — including the multi-date case found in Section 4,
  where a single `due_date` field can't represent two deadlines in one message.
- **Summary usefulness**: whether the generated `summary` actually names the correct
  concrete next step (sign up here, submit there, by when) versus a vague restatement
  — likely needs human or LLM-as-judge rating rather than exact-match scoring.
- **Latency and cost per message**: wall-clock time and token cost of the single
  OpenAI call, as a baseline to compare against a more complex (multi-call, tool-use)
  future system.
- **Tool failure rate**: how often the Gmail client or the JSON parse step fails, as
  ingestion reliability matters independently of extraction quality.

This baseline does not yet have an evaluation harness; the next phase will add a
labeled test set and a script that computes these metrics automatically.

## Section 7. Limitations and Next Steps

**Known weaknesses.**
- Single source (Gmail/Canvas only). An earlier version of this project also ingested
  Slack messages; it was removed to keep the baseline's scope concrete and its
  reproducibility story simple — a grader can point their own Canvas-enrolled Gmail
  at this code and get a meaningful result, whereas verifying Slack ingestion would
  additionally require a Slack workspace, a bot token, and channel access, none of
  which transfer between accounts the way the Gmail filter does.
- A message with more than one deadline only gets one `due_date` (see Section 4) —
  the schema needs to support multiple dates or a documented selection rule.
- No deduplication across overlapping emails (a reminder and a follow-up about the
  same deadline become two separate records).
- Relative dates ("next Friday", "this week") are left to the model to resolve
  without being given the message's actual timestamp, which risks incorrect absolute
  dates.
- A message that fails JSON parsing is silently treated as irrelevant rather than
  retried or flagged for review.
- English-only prompt; no evaluation yet of non-English messages.
- No write-back (calendar, to-do list) — the system only observes, it does not act.
- Classification is not fully deterministic run-to-run (observed in an earlier run:
  the same message was typed `"course"` on one run and `"task"` on another).

**Expected failure cases.** Messages that mention a date unrelated to a deadline
(e.g., "the meeting last Tuesday"), ambiguous course references without an explicit
code, long email threads where the actionable content is buried under quoted reply
history, and messages with multiple deadlines (Section 4).

**Next phase.** Support multiple due dates per message; pass message timestamps into
the extraction prompt so relative dates resolve correctly; add deduplication; build
the labeled evaluation set and metrics script described in Section 6; add an optional
write-back step (create a calendar event) gated behind user confirmation; consider
reintroducing a second source (Slack, or a syllabus/LMS feed) once the single-source
baseline's evaluation harness exists to measure whether it's actually worth the added
reproducibility cost.

**Risks.** API rate limits/cost if scaled to a full inbox history; Gmail API quota
and OAuth app verification requirements if this needs to run for users other than the
developer; because the current version has no bundled sample data, a grader without
their own Gmail access can read the code and the pasted output/screenshot in Section
4 but cannot re-execute the exact same run — a possible reintroduction of an offline
fixture mode (fed by real, anonymized message exports) is worth considering next
phase specifically to de-risk this for grading/demos.

**Help / infrastructure needed.** A personal OpenAI API key, a Google Cloud project
with the Gmail API enabled, and Node.js for the dashboard.
