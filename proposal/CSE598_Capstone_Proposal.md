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
sorted by `due_date`, plus a Next.js dashboard (`dashboard/`) that reads that JSON file
and renders it as filterable cards with due-date status (overdue / due soon / later).

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
  JSON or in a live-updating Next.js dashboard.

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
ingestion; a Next.js app for the dashboard. There is no bundled sample/offline data —
every run reads the requester's actual Gmail inbox and/or Slack channel.

**What it does, step by step.**
1. Load messages from the chosen `--source`: live Gmail (filtered to
   `from:notifications@instructure.com` by default), live Slack, or both (`all`,
   the default).
2. Normalize each message to `{source, sender, subject/channel, text}`.
3. Send each message's text to OpenAI with a fixed system prompt asking for one JSON
   object: `is_relevant`, `type`, `title`, `course_code`, `due_date`, `priority`,
   `summary`.
4. Filter to relevant results, sort by `due_date`.
5. Write the sorted list to `output/tasks_and_courses.json` and print a
   human-readable summary line per message.
6. Separately, `dashboard/` (a small Next.js app) reads that JSON file through an API
   route and renders it as stat counts plus filterable, due-date-colored cards,
   polling every 8 seconds so it stays in sync with the latest run.

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
- [`dashboard/pages/index.js`](../dashboard/pages/index.js),
  [`dashboard/pages/api/tasks.js`](../dashboard/pages/api/tasks.js) — the Next.js
  dashboard and the API route it reads data from.

## Section 4. Test Case and Baseline Output

**Sample input.** A live pull from the student's own Gmail inbox
(`from:notifications@instructure.com`) and/or a live Slack channel, via:
```bash
python run_baseline.py --source all --limit 10
```
The Gmail step requires completing an interactive OAuth consent screen in a browser
the first time it runs (see Section 5) — this cannot be scripted or faked, so the
concrete test case below reflects a real run against real Canvas notification emails
and/or Slack messages, not synthetic data.

**Expected behavior.** Canvas notification emails that state an assignment deadline,
an announcement, or an enrollment/meeting-time fact should be flagged `is_relevant:
true` with a reasonable `title` and, where stated, `course_code` and `due_date`.
Purely informational notifications (e.g. a posted grade) and off-topic Slack chatter
should be flagged `is_relevant: false`.

**Actual baseline output.** *[Run the command above with your own `OPENAI_API_KEY`
and Gmail/Slack credentials configured (see Section 5), then paste the console output,
the resulting `output/tasks_and_courses.json`, and a screenshot of both the terminal
and the Next.js dashboard (`npm run dev` in `dashboard/`, then
http://localhost:3000) here before submitting to Canvas.]*

**What worked / what did not work.** *[Fill in after running against your own
inbox/Slack: note anything the model mis-flagged, e.g. whether it correctly resolved
relative dates, whether any two records described the same underlying event, or
whether an irrelevant notification (e.g. a grade-posted email) was correctly skipped.]*

**Preliminary validation (prior to removing bundled fixtures).** Before switching to
this live-only version, the same extraction pipeline (`src/extractor.py`, unchanged)
was run against 7 synthetic messages styled as real Canvas notification emails and
Slack messages, correctly classifying 5/7 as relevant with the right course codes.
That run also surfaced two genuine limitations that still apply here and are recorded
in Section 7: (1) a message stating only "today, September 6" with no year was
extracted with a hallucinated wrong year, and (2) the same underlying event reported
via both Gmail and Slack produced two separate, undeduplicated records. See the
git history (`5e0fb2c`) for the full transcript.

## Section 5. Reproducibility and Run Instructions

**Dependencies.** Python 3.10+ and Node 18+; see [`requirements.txt`](../requirements.txt)
(`openai`, `python-dotenv`, `google-api-python-client`, `google-auth-httplib2`,
`google-auth-oauthlib`, `slack_sdk`) and [`dashboard/package.json`](../dashboard/package.json)
(`next`, `react`, `react-dom`).

**Install.**
```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # fill in OPENAI_API_KEY + Gmail/Slack credentials
cd dashboard && npm install && cd ..
```

**Required environment variables.** `OPENAI_API_KEY` is required for every run. At
least one of Gmail (`GMAIL_CREDENTIALS_PATH`) or Slack (`SLACK_BOT_TOKEN`,
`SLACK_CHANNEL_ID`) credentials is required, since there is no offline/sample mode.
Full reference in [`examples/readme.md`](../examples/readme.md).

**Exact commands to run the baseline and view it:**
```bash
python run_baseline.py --source all --limit 10
cd dashboard && npm run dev   # then open http://localhost:3000
```

**Input location.** Live Gmail inbox (via the Gmail API) and/or a live Slack channel
(via `conversations.history`) — not a file in the repo.

**Output location.** `output/tasks_and_courses.json`, plus a printed summary on
stdout; the Next.js dashboard at `http://localhost:3000` reads that file directly.

**Known setup limitations.** Live Gmail auth opens a browser for OAuth consent — a
person must click through it once (won't work headless without port forwarding); the
Slack bot must be invited to its target channel before `conversations.history` can
read it. Because there is no bundled sample data, a grader without the student's own
Gmail/Slack access cannot literally reproduce the exact same output — they can verify
the code runs correctly against their *own* Gmail (the `from:notifications@instructure.com`
filter works for any Canvas account) or Slack workspace, and should otherwise rely on
the pasted output/screenshot in Section 4 as evidence.

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
than the developer; because the current version has no bundled sample data, a grader
without their own Gmail/Slack access can read the code and the pasted output/screenshot
in Section 4 but cannot re-execute the exact same run — a possible reintroduction of an
offline fixture mode (fed by real, anonymized message exports) is worth considering
next phase specifically to de-risk this for grading/demos.

**Help / infrastructure needed.** A personal OpenAI API key, a Google Cloud project
with the Gmail API enabled, a Slack app/bot token for testing, and Node.js for the
dashboard.
