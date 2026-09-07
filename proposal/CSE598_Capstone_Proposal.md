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
`{ type: "task" | "course", title, course_code, due_date, priority, overview, steps,
source }`, sorted by `due_date`, plus a Next.js dashboard (`dashboard/`) that renders
it as filterable cards with due-date status (overdue / due soon / later), a calendar,
and a per-day overview. Any record can also be pushed to the user's real Google
Tasks or Google Calendar (routed automatically by type/date).

**Success / failure.** For a message that states or clearly implies a deadline or
course fact:
- **Success**: the system flags it as relevant, produces an accurate title, and
  (when present in the text) an accurate `course_code` and `due_date`, plus an
  `overview` (what this is) and a `steps` checklist that names the concrete next
  step(s) (what to sign up for, what form/link was given, what's due when).
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
concrete action checklist from arbitrary phrasing in one call. Framing this as an
*agentic* system (rather than a static classifier) also matters for where the project
goes next - the baseline now pushes to Google Tasks/Calendar (Section 3, Section 4),
a first real action, not just a report; later phases would add tool use (checking a
linked form's status) and a review step before a push happens.

**In scope this semester.**
- Read-only ingestion from Gmail, scoped to Canvas/Instructure notification emails
  (Gmail API, OAuth2, search-filtered).
- Per-message LLM-based classification and structured extraction (task vs. course vs.
  neither, title, course code, due date, priority, an `overview` sentence, and a
  `steps` checklist).
- A consolidated, due-date-sorted output list from a single batch fetch, viewable as
  JSON or in a live-updating Next.js dashboard (cards, calendar, day overview).
- Write-back: pushing an extracted record to the user's real Google Tasks or Google
  Calendar, routed automatically (a dated course fact -> Calendar event, anything
  actionable -> Task), gated behind a manual click, never automatic on every run.

**Out of scope this semester.**
- Editing/reviewing an extraction before it's pushed to Tasks/Calendar (see Section 7
  — the write-back pushes the raw extraction as-is, hallucinations included).
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
   object: `is_relevant`, `type`, `title`, `course_code`, `due_date`, `priority`,
   `overview` (one sentence: what this is), and `steps` (a checklist of concrete
   actions - "sign up on the linked sheet by Sept 8", "submit via Canvas" - empty if
   nothing actionable beyond being aware of it).
4. Filter to relevant results, sort by `due_date`.
5. Write the sorted list to `output/tasks_and_courses.json`, and every fetched
   message (relevant or not) to `output/all_messages.json`, printing a
   human-readable summary line per message.
6. Any record can be pushed (`POST /api/actions/push[-all]`) to the user's real
   Google Tasks or Google Calendar; `overview` + `steps` become the note/description,
   formatted as a checklist rather than the prose paragraph the schema used to
   produce (see Section 4 for what that push actually looked like on real data).
7. Steps 1-5 live in `backend/services/pipeline.py`, called by a FastAPI backend
   (`backend/main.py`, a small router-per-resource app) that exposes them as a JSON
   API (`GET /api/tasks`, `GET /api/messages`, `POST /api/run`, plus settings and
   Gmail-connection endpoints). The Next.js frontend (`dashboard/`) has no filesystem
   or Gmail/OpenAI access of its own — it only calls that API — and renders
   filterable, due-date-colored cards, a month/week/day calendar built from the due
   dates, and a "Day overview" panel showing every message tied to whichever day is
   selected, polling every 8 seconds so it stays in sync with the latest run.

**Why this is a reasonable starting point.** It is the simplest system that touches
every piece the target problem needs — a real ingestion client, one LLM call doing
the actual judgment and checklist generation, and a real (if narrow) write-back
action — without yet requiring multi-step planning, chained tool calls, or
persistent memory. It is a genuine "single-call model baseline" per message, which
makes its failure modes easy
to attribute (bad extraction vs. bad ingestion) when building the next phase.

**Files.**
- [`backend/main.py`](../backend/main.py) — FastAPI app assembly (CORS + routers);
  nothing else lives here.
- [`backend/routers/`](../backend/routers) — one file per resource: `tasks.py`
  (`GET /api/tasks`, `/api/messages`), `run.py` (`POST /api/run`), `settings.py`
  (`GET`/`POST /api/settings`), `gmail.py` (`GET`/`POST /api/gmail-auth`),
  `actions.py` (`GET /api/actions/status`, `POST /api/actions/push[-all]` — routes
  each record to Google Tasks or Calendar via `_destination()`).
- [`backend/services/pipeline.py`](../backend/services/pipeline.py) — the actual
  fetch → extract → write logic, called by `POST /api/run`; kept separate from the
  FastAPI layer so it's plain Python, easy to read or test on its own.
- [`backend/services/extractor.py`](../backend/services/extractor.py) — the single
  OpenAI call.
- [`backend/services/gmail_client.py`](../backend/services/gmail_client.py) — live
  Gmail ingestion, search-filtered to `from:notifications@instructure.com` by
  default.
- [`backend/services/google_auth.py`](../backend/services/google_auth.py) — shared
  OAuth (Gmail-readonly, Tasks, Calendar-events scopes in one consent flow); self-
  heals if a stored token predates a newly added scope (called from `routers/gmail.py`
  in a background thread for the "Connect Gmail" button).
- [`backend/services/google_tasks_client.py`](../backend/services/google_tasks_client.py),
  [`backend/services/google_calendar_client.py`](../backend/services/google_calendar_client.py) —
  create a real Google Task / Calendar all-day event from an extracted record.
- [`backend/services/notes.py`](../backend/services/notes.py) — formats `overview` +
  `steps` into the plain-text checklist used as the note/description.
- [`backend/services/sync_store.py`](../backend/services/sync_store.py) — tracks
  which records were already pushed and to which destination
  (`output/google_actions_sync.json`) so re-pushing never duplicates.
- [`backend/core/config.py`](../backend/core/config.py) — reads `config.json`
  (gitignored local state, like `.env`; the backend falls back to safe hardcoded
  defaults if it doesn't exist) for non-secret settings.
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
(`from:notifications@instructure.com`), via the backend's own API:
```bash
uvicorn backend.main:app --reload --port 8000
curl -X POST http://localhost:8000/api/run -H "Content-Type: application/json" -d '{"limit": 15}'
```
(or the same call made through http://localhost:8000/docs, or the dashboard
Settings page's **Run now** button). This requires completing an interactive OAuth
consent screen in a browser the first time it runs (see Section 5) — this cannot be
scripted or faked, so the test case below reflects a real run against a real
Canvas-enrolled Gmail account, not synthetic data.

**Expected behavior.** Canvas notification emails that state an assignment deadline,
a sign-up requirement, or an enrollment/meeting-time fact should be flagged
`is_relevant: true` with a reasonable `title`, an `overview` (one sentence: what this
is) and `steps` (a checklist of concrete actions, empty if nothing actionable), and,
where stated, `course_code` and `due_date`. Purely informational notifications (e.g. a
posted grade with no further action) should still be flagged relevant but with an
empty `steps` list. Pushing a record via `POST /api/actions/push` should create a
Google Calendar event for a dated course fact (exam, class session,
deadline-as-event) or a Google Task for anything actionable, with the checklist
carried into the note/description.

**Actual baseline output.** Ran `POST /api/run` with `{"limit": 15}` against a real
Canvas-enrolled Gmail account: fetched 15 messages, all 15 flagged relevant. Three
representative records from `output/tasks_and_courses.json`:

```json
{
  "is_relevant": true,
  "type": "course",
  "title": "Assignment Graded for CSE 598",
  "course_code": "CSE 598",
  "due_date": "2023-08-31",
  "priority": null,
  "overview": "Grade notification for the assignment 'Formulating Agent' in CSE 598.",
  "steps": []
}
```
```json
{
  "is_relevant": true,
  "type": "both",
  "title": "Paper and Presentation Slot Sign-Up for CSE 598",
  "course_code": "CSE 598",
  "due_date": "2026-09-06",
  "priority": "high",
  "overview": "Students must register for Paper Sharing groups and select presentation slots for CSE 598.",
  "steps": [
    "Form a Paper Sharing group of 5 students.",
    "Select a paper from the provided list.",
    "Enter your group number in the row corresponding to your selected paper.",
    "Select an available presentation time in the Presentation Slots section.",
    "Register your group before September 6."
  ]
}
```
```json
{
  "is_relevant": true,
  "type": "course",
  "title": "Week 2 Lecture Notes for CSE 598",
  "course_code": "CSE598",
  "due_date": "2026-09-15",
  "priority": "medium",
  "overview": "Lecture notes and course FAQs for CSE 598 available on Canvas.",
  "steps": ["Review the Week 2 lecture notes before Thursday's class."]
}
```

**Write-back output.** Pushed the first two records via `POST /api/actions/push`:
```
POST /api/actions/push {"source_id": "1a05a406d48d9cc1"}  # "Assignment Graded", type=course + due_date
-> {"status": "created", "kind": "event", "id": "mgj3hd8m7pas2s5u9e2o5bc694"}

POST /api/actions/push {"source_id": "1a040a48e78f1881"}  # "Paper and Presentation Slot Sign-Up", type=both
-> {"status": "created", "kind": "task", "id": "R0NpdnhVckRsTGpFX0dpYQ"}
```
Reading them back directly from the Google APIs confirmed the routing and the
checklist formatting both worked as designed — the Calendar event was created as an
all-day event on `2023-08-31` with the `overview` as its description; the Task was
created with `due: 2026-09-06T00:00:00.000Z` and this note:
```
Students must register for Paper Sharing groups and select presentation slots for CSE 598.

What needs to be done:
☐ Form a Paper Sharing group of 5 students.
☐ Select a paper from the provided list.
☐ Enter your group number in the row corresponding to your selected paper.
☐ Select an available presentation time in the Presentation Slots section.
☐ Register your group before September 6.
```

*[Paste a screenshot of the terminal run and the dashboard (`uvicorn backend.main:app
--reload` in one terminal, `npm run dev` in `dashboard/` in another, then
http://localhost:3000 — cards, calendar, Day overview, and the "Add to Google
Tasks"/"Add to Google Calendar" buttons) here before submitting to Canvas.]*

**What worked.** Relevance classification was accurate for every message in this run.
The `overview`/`steps` split is a real improvement over the earlier single prose
`summary` field: the presentation sign-up correctly decomposed into five distinct,
independently actionable steps rather than one paragraph the reader has to parse
themselves, and a pure grade notification correctly produced an empty `steps` list
instead of inventing an action that isn't there. The Task/Calendar routing rule
worked exactly as intended on real data: the course fact with a date became a
Calendar event, the actionable sign-up became a Task, and the checklist rendered
cleanly in both destinations' native UI.

**What did not work.** Two things worth noting: (1) the first example's `due_date`
is `"2023-08-31"` — a hallucinated wrong year; the email states only "Aug 31" with no
year, and the model guessed one already in the past instead of inferring the current
year from context or leaving it null. Since this record was routed to Calendar
specifically *because* it had a `due_date`, the hallucination directly caused a
wrongly-dated Calendar event, not just a display glitch — a concrete case where an
extraction error propagates into a real external side effect. (2) The
`type: "course"` + dated-fact → Calendar rule is a coarse proxy for "is this an
event" — "Assignment Graded" is really a past-tense notification, not an event to
attend, yet it still routed to Calendar because it happens to have type `course` and
a (wrong) date; a truer signal would need the model to explicitly classify
event-vs-non-event rather than inferring it from `type` + presence of `due_date`.

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
uvicorn backend.main:app --reload --port 8000
curl -X POST http://localhost:8000/api/run -H "Content-Type: application/json" -d '{"limit": 15}'
```
This alone reproduces the test case (writes `output/*.json`, no dashboard needed —
verify via `curl http://localhost:8000/api/tasks` or http://localhost:8000/docs). To
also view it in the dashboard, add a second terminal:
```bash
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
- **Checklist usefulness**: whether the generated `steps` actually name the correct
  concrete next step(s) (sign up here, submit there, by when) versus a vague
  restatement, and whether `steps` is correctly empty for non-actionable messages —
  likely needs human or LLM-as-judge rating rather than exact-match scoring.
- **Routing correctness**: for pushed records, whether `_destination()`'s Task-vs-
  Calendar choice actually matched what a human would pick — the "Assignment Graded"
  case in Section 4 (routed to Calendar despite not being an event) is exactly the
  kind of error this metric would catch.
- **Latency and cost per message**: wall-clock time and token cost of the single
  OpenAI call, as a baseline to compare against a more complex (multi-call, tool-use)
  future system.
- **Tool failure rate**: how often the Gmail client, the JSON parse step, or a
  Tasks/Calendar push fails, as ingestion and write-back reliability matter
  independently of extraction quality.

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
- Write-back exists now (`POST /api/actions/push[-all]`, gated behind a manual click,
  never automatic) and routes to either Google Tasks or Google Calendar, but the
  routing rule is a coarse proxy - `type == "course"` plus a non-null `due_date` -
  not an explicit event/non-event judgment from the model. Section 4's "Assignment
  Graded" example shows this concretely: a past-tense grade notification with a
  hallucinated date got routed to Calendar and created a wrongly-dated event, purely
  because it satisfied the proxy condition. There is also no review/edit step between
  extraction and the actual write - whatever the extraction got wrong (a hallucinated
  date, a wrong destination) gets pushed as-is.
- Classification is not fully deterministic run-to-run (observed in an earlier run:
  the same message was typed `"course"` on one run and `"task"` on another) - this
  also means the Task-vs-Calendar routing for that message could flip between runs.

**Expected failure cases.** Messages that mention a date unrelated to a deadline
(e.g., "the meeting last Tuesday"), ambiguous course references without an explicit
code, long email threads where the actionable content is buried under quoted reply
history, and messages with multiple deadlines (Section 4).

**Next phase.** Support multiple due dates per message; pass message timestamps into
the extraction prompt so relative dates resolve correctly; add deduplication; build
the labeled evaluation set and metrics script described in Section 6; have the model
explicitly classify event-vs-non-event instead of inferring it from `type` +
`due_date`, to fix the routing failure mode in Section 4; add an inline review/edit
step (confirm or correct the title/date/destination before it's pushed, rather than
pushing the raw extraction); consider reintroducing a second source (Slack, or a
syllabus/LMS feed) once the single-source baseline's evaluation harness exists to
measure whether it's actually worth the added reproducibility cost.

**Risks.** API rate limits/cost if scaled to a full inbox history; Gmail/Tasks/
Calendar API quota and OAuth app verification requirements if this needs to run for
users other than the developer; a wrongly-routed or wrongly-dated push writes to the
user's *real* Tasks/Calendar, so an extraction error now has a real-world side
effect, not just a wrong line in a JSON file - the review/edit step above is the
mitigation, not yet built; because the current version has no bundled sample data, a
grader without their own Gmail access can read the code and the pasted
output/screenshot in Section 4 but cannot re-execute the exact same run — a possible
reintroduction of an offline fixture mode (fed by real, anonymized message exports)
is worth considering next phase specifically to de-risk this for grading/demos.

**Help / infrastructure needed.** A personal OpenAI API key, a Google Cloud project
with the Gmail API, Google Tasks API, and Google Calendar API all enabled, and
Node.js for the dashboard.
