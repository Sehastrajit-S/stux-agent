# Stux Agent — Task & Course Extraction from Email

A single-call OpenAI baseline that reads live Canvas (Instructure) notification emails
and extracts structured tasks (assignments, deadlines) and course facts (enrollment,
meeting times, office hours) into one consolidated, sorted list. A FastAPI backend
does all the Gmail/OpenAI/config work; a Next.js frontend is pure display, calling
the backend over HTTP.

## Architecture

```
run_baseline.py (CLI)  ──┐
                          ├──> src/pipeline.py ──> src/gmail_client.py, src/extractor.py
src/backend/main.py (API)  ──┘         (fetch + extract + write output/*.json)

dashboard/ (Next.js, pure frontend)  ──HTTP──>  src/backend/main.py (FastAPI, localhost:8000)
```

`run_baseline.py` and `src/backend/main.py` both call the same `src/pipeline.py` function
— one implementation of the actual fetch-and-extract logic, not two copies that can
drift. The dashboard holds no business logic: no file reads, no Gmail/OpenAI calls, no
subprocess spawning — every dynamic page just calls the backend's JSON API.

## What it does

1. Loads recent messages from live Gmail (filtered to
   `from:notifications@instructure.com` by default, via OAuth).
2. Normalizes each message to `{source, sender, subject, text, received_at}`.
3. Sends each message's text to an OpenAI model (one API call per message,
   [src/extractor.py](src/extractor.py)) with a fixed prompt asking it to return a single
   JSON object: is this relevant, and if so what's the title / course code / due date /
   priority / a practical overview of what to actually do.
4. Filters to relevant items, sorts by due date, writes `output/tasks_and_courses.json`
   (plus `output/all_messages.json` with every fetched message, relevant or not).
5. The FastAPI backend (`src/backend/main.py`) serves those results — and can trigger a
   fresh run itself — over a small JSON API. The Next.js dashboard (`dashboard/`)
   calls that API and renders filterable cards, a calendar, and a "Day overview,"
   polling every 8 seconds.

There is no bundled sample/offline data — every run reflects your actual inbox at the
time you run it.

## Files

- `run_baseline.py` — CLI entry point (thin wrapper over `src/pipeline.py`).
- `src/backend/main.py` — FastAPI app: serves `output/*.json`, triggers a pipeline run,
  reads/writes `config.json`, and runs the Gmail OAuth flow — everything the dashboard
  needs, over HTTP.
- `src/pipeline.py` — the actual fetch → extract → write logic, shared by the CLI and
  the API so there's one source of truth.
- `src/extractor.py` — the single OpenAI API call that does the extraction.
- `src/gmail_client.py` — live Gmail ingestion via the Gmail API (OAuth2), filtered by
  Gmail search query (defaults to Canvas/Instructure notification emails).
- `src/gmail_login.py` — standalone OAuth consent flow (also importable; the backend
  runs it in a background thread for the dashboard's "Connect Gmail" button).
- `src/config.py` — reads `config.json` (Gmail query, message limit) so a value saved
  from the dashboard's Settings page is picked up by the next run, CLI or API alike.
- `dashboard/` — Next.js app, pure frontend: `/` shows filterable, due-date-colored
  cards plus a calendar and a "Day overview" of that day's messages; `/settings` edits
  config, connects Gmail, triggers a run, and toggles dark mode — all via
  `dashboard/lib/api.js` calling the FastAPI backend. No API routes of its own.
- `config.json` (gitignored, like `.env`) — non-secret settings shared between the
  backend and the CLI (Gmail query, message limit), written by the Settings page. No
  API keys/tokens are ever stored here; both fall back to safe hardcoded defaults if
  it doesn't exist yet.
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

## Running the baseline (CLI)

```bash
python run_baseline.py
python run_baseline.py --limit 20 --gmail-query "from:notifications@instructure.com"
```

- **Input**: your live Gmail inbox (filtered by `GMAIL_QUERY`), fetched fresh on every run.
- **Output**: printed summary on stdout, structured results written to
  `output/tasks_and_courses.json` and `output/all_messages.json`.

## Running the backend + dashboard

Two terminals:

```bash
# Terminal 1 — API
uvicorn src.backend.main:app --reload --port 8000

# Terminal 2 — frontend
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It calls the backend at
`http://localhost:8000` (override with `NEXT_PUBLIC_API_BASE` — see
[`dashboard/.env.local.example`](dashboard/.env.local.example)) and polls it every 8
seconds, so re-running the pipeline (CLI, or the Settings page's **Run now** button)
updates the page without a restart. If the backend isn't reachable or has no output
yet, the page says so explicitly rather than showing placeholder data. Use the
**⚙ Settings** link (top right) to change the Gmail query or message limit, connect
Gmail, or trigger a run — all without touching a terminal.

## Known setup limitations

- The first live Gmail run opens a browser window for OAuth consent; this is an
  interactive step a person must complete (it cannot be scripted), and will not work
  in a headless environment without port forwarding.
- The backend and dashboard are two separate processes — both need to be running for
  the dashboard to show anything.
- Because there is no bundled sample data, reproducing a specific run requires access
  to the same (or equivalent) Gmail credentials — see the proposal's Section 5 for how
  this affects grading reproducibility.
- The model's date/relevance judgments are not guaranteed correct — see Section 7 of
  the proposal for known failure modes.
