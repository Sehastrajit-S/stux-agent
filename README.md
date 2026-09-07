# Stux Agent — Task & Course Extraction from Email

A single-call OpenAI baseline that reads live Canvas (Instructure) notification emails
and extracts structured tasks (assignments, deadlines) and course facts (enrollment,
meeting times, office hours) into one consolidated, sorted list. A FastAPI backend
does all the Gmail/OpenAI/config work; a Next.js frontend is pure display, calling
the backend over HTTP.

## Architecture

```
backend/main.py (FastAPI, localhost:8000)
        │
        ├──> backend/routers/*.py (endpoints)
        │        │
        │        └──> backend/services/pipeline.py
        │                 ├──> backend/services/gmail_client.py (Gmail)
        │                 ├──> backend/services/extractor.py (OpenAI)
        │                 └──> backend/core/config.py (config.json)
        │                      (fetch + extract + write output/*.json)
        ▼
dashboard/ (Next.js, pure frontend)  ──HTTP──>  backend/main.py
```

The backend is the only entry point — there's no separate CLI script. The dashboard
holds no business logic: no file reads, no Gmail/OpenAI calls, no subprocess spawning
— every dynamic page just calls the backend's JSON API.

## What it does

1. Loads recent messages from live Gmail (filtered to
   `from:notifications@instructure.com` by default, via OAuth).
2. Normalizes each message to `{source, sender, subject, text, received_at}`.
3. Sends each message's text to an OpenAI model (one API call per message,
   [backend/services/extractor.py](backend/services/extractor.py)) with a fixed prompt
   asking it to return a single JSON object: is this relevant, and if so the title /
   course code / due date / priority, plus an `overview` (one sentence: what this is)
   and `steps` (a checklist of concrete actions) rather than a prose summary.
4. Filters to relevant items, sorts by due date, writes `output/tasks_and_courses.json`
   (plus `output/all_messages.json` with every fetched message, relevant or not).
5. The FastAPI backend (`backend/main.py`) serves those results and can trigger a
   fresh run itself (`POST /api/run`) over a small JSON API. The Next.js dashboard
   (`dashboard/`) calls that API and renders filterable cards, a calendar, and a
   "Day overview," polling every 8 seconds.
6. From the dashboard, any card (or all of them at once) can be pushed to the user's
   real Google account (`POST /api/actions/push[-all]`) — a real action taken on the
   extraction, not just a report, gated behind a manual click rather than happening
   automatically on every run. Routing is automatic: a dated course fact (an exam,
   a class session, a deadline-as-event) becomes a **Google Calendar** all-day event;
   anything actionable (a task, or a task+course combo) becomes a **Google Task**
   with that due date attached. Either way the description is the `overview` +
   `steps` checklist, not a paragraph. Already-pushed records are tracked
   (`output/google_actions_sync.json`) so nothing gets duplicated on a re-run or a
   second click.

There is no bundled sample/offline data — every run reflects your actual inbox at the
time you run it.

## Files

- `backend/main.py` — FastAPI app assembly (CORS + routers). Nothing else lives here.
- `backend/routers/` — one file per resource: `tasks.py` (`GET /api/tasks`,
  `/api/messages`), `run.py` (`POST /api/run`), `settings.py` (`GET`/`POST
  /api/settings`), `gmail.py` (`GET`/`POST /api/gmail-auth`), `actions.py`
  (`GET /api/actions/status`, `POST /api/actions/push[-all]` — routes each record to
  Google Tasks or Google Calendar; see `_destination()` in that file for the rule).
- `backend/schemas.py` — Pydantic request models (`RunRequest`, `ConfigUpdate`).
- `backend/utils.py` — shared helpers (`read_json`, `iso`) used by the routers.
- `backend/services/pipeline.py` — the actual fetch → extract → write logic, called by
  `POST /api/run`; kept separate from the FastAPI layer so it's plain Python, easy to
  read or test on its own.
- `backend/services/extractor.py` — the single OpenAI API call that does the extraction.
- `backend/services/gmail_client.py` — live Gmail ingestion via the Gmail API (OAuth2),
  filtered by Gmail search query (defaults to Canvas/Instructure notification emails).
- `backend/services/google_auth.py` — shared OAuth (Gmail-readonly, Tasks, and
  Calendar-events scopes in one consent flow); self-heals if a stored token predates
  a newly added scope.
- `backend/services/google_tasks_client.py`,
  `backend/services/google_calendar_client.py` — create a real Google Task /
  Calendar all-day event from an extracted record.
- `backend/services/notes.py` — formats a record's `overview` + `steps` into the
  plain-text checklist used as the Task note / event description.
- `backend/services/sync_store.py` — tracks which records were already pushed, and to
  which destination (`output/google_actions_sync.json`), so re-pushing never duplicates.
- `backend/core/config.py` — reads `config.json` (Gmail query, message limit) so a
  value saved from the dashboard's Settings page is picked up by the backend's next run.
- `dashboard/` — Next.js app, pure frontend: `/` shows filterable, due-date-colored
  cards (each with an "Add to Google Tasks"/"Add to Google Calendar" action depending
  on the record, plus a bulk "Add all") plus a calendar and a "Day overview" of that
  day's messages; `/settings` edits config, connects Gmail, triggers a run, and
  toggles dark mode — all via `dashboard/lib/api.js` calling the FastAPI backend. No
  API routes of its own.
- `config.json` (gitignored, like `.env`) — non-secret settings (Gmail query, message
  limit) written by the Settings page and read by the backend. No API keys/tokens are
  ever stored here; the backend falls back to safe hardcoded defaults if it doesn't
  exist yet.
- `examples/readme.md` — configuration / environment variable reference (the
  "Configuration location" for this project).
- `proposal/CSE598_Capstone_Proposal.md` — the capstone proposal document.

## Setup

Requires Python 3.10+ and Node 18+.

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # fill in OPENAI_API_KEY plus Gmail credentials
cd dashboard && npm install && cd ..
```

### Required API keys / environment variables

See [examples/readme.md](examples/readme.md) for the full reference. Short version:

| Variable | Required for | Notes |
|---|---|---|
| `OPENAI_API_KEY` | every run | [platform.openai.com](https://platform.openai.com) |
| `OPENAI_MODEL` | optional | defaults to `gpt-4o-mini` |
| `GMAIL_CREDENTIALS_PATH`, `GMAIL_TOKEN_PATH` | every run | OAuth client secret from Google Cloud Console |

## Running it

Two terminals:

```bash
# Terminal 1 — API
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It calls the backend at
`http://localhost:8000` (override with `NEXT_PUBLIC_API_BASE` — see
[`dashboard/.env.local.example`](dashboard/.env.local.example)) and polls it every 8
seconds, so re-running the pipeline (the Settings page's **Run now** button, or
`POST /api/run` directly) updates the page without a restart. If the backend isn't
reachable or has no output yet, the page says so explicitly rather than showing
placeholder data. Use the **⚙ Settings** link (top right) to change the Gmail query
or message limit, connect Gmail, or trigger a run — all without touching a terminal.

**No frontend needed to test the API on its own:** with just the backend running,
open [http://localhost:8000/docs](http://localhost:8000/docs) for FastAPI's built-in
interactive Swagger UI — expand an endpoint, click "Try it out," click "Execute," and
see the real response. `POST /api/run` there triggers a real Gmail fetch.

## Known setup limitations

- The first live Gmail run opens a browser window for OAuth consent; this is an
  interactive step a person must complete (it cannot be scripted), and will not work
  in a headless environment without port forwarding.
- The backend and dashboard are two separate processes — both need to be running for
  the dashboard to show anything (the backend alone is enough if you're testing via
  `/docs`).
- Because there is no bundled sample data, reproducing a specific run requires access
  to the same (or equivalent) Gmail credentials — see the proposal's Section 5 for how
  this affects grading reproducibility.
- The model's date/relevance judgments are not guaranteed correct — see Section 7 of
  the proposal for known failure modes.
- Pushing to Google Tasks/Calendar requires the **Google Tasks API** and **Google
  Calendar API** to each be enabled for your Cloud project (Cloud Console → APIs &
  Services → Library → search each name → Enable) — the same one-time step as
  enabling the Gmail API, easy to miss since each is a separate API even though all
  three use the same OAuth client. A token created before a scope was added lacks it;
  the backend detects this automatically and re-prompts for consent (covering every
  scope at once) instead of failing silently on the next call that needs it.
