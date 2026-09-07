# Configuration

This baseline is configured entirely through environment variables. Copy `.env.example`
(repo root) to `.env` and fill in your values, or export them in your shell. The
backend (`src/backend/main.py`) loads this same `.env` file, since it's the process that
actually talks to Gmail and OpenAI — the dashboard never touches these values.

**Required for every run:**
- `OPENAI_API_KEY` — OpenAI API key for the single-call extraction step (used by
  `src/extractor.py`).
- `OPENAI_MODEL` (optional, defaults to `gpt-4o-mini`).
- `GMAIL_CREDENTIALS_PATH` (default `credentials.json`) — OAuth client secret JSON
  downloaded from Google Cloud Console (Gmail API enabled, "Desktop app" credential type).
- `GMAIL_TOKEN_PATH` (default `token.json`) — created automatically the first time you
  complete the interactive OAuth consent flow (opens a browser, or use the "Connect
  Gmail" button on the dashboard's Settings page, which asks the backend to run it).
- `GMAIL_QUERY` (optional, defaults to `from:notifications@instructure.com`) — Gmail
  search syntax restricting which emails are pulled.

**There is no offline/sample mode.** Both `run_baseline.py` and the backend only read
live Gmail — every run needs real, current credentials. The OAuth flow opens a
browser window on first run; this step is interactive and must be completed by a
person (it cannot be scripted).

## Non-secret settings (`config.json`)

`GMAIL_QUERY` and the message limit can also be set in `config.json` at the repo root
(edited via the dashboard's Settings page, which calls `POST /api/settings` on the
backend, or by hand). Precedence is CLI flag > `config.json` > environment variable /
built-in default. This file holds no secrets — only the query string and a number.

## Backend (FastAPI)

`src/backend/main.py` is the only process that reads `.env`, `credentials.json`,
`token.json`, and `config.json`, and the only one that calls Gmail or OpenAI. Run it
with `uvicorn src.backend.main:app --reload --port 8000`. Routes:
- `GET /api/tasks`, `GET /api/messages` — read `output/tasks_and_courses.json` /
  `output/all_messages.json`.
- `POST /api/run` — runs the fetch-and-extract pipeline (`src/pipeline.py`) and
  rewrites those files.
- `GET /api/settings`, `POST /api/settings` — read/write `config.json`, and report
  (as booleans, never actual values) whether `OPENAI_API_KEY` and Gmail credentials
  are present.
- `GET /api/gmail-auth`, `POST /api/gmail-auth` — check connection status / run the
  OAuth flow in a background thread.

CORS is restricted to `http://localhost:3000`. To allow another frontend origin,
adjust `allow_origins` in `src/backend/main.py`.

## Dashboard (Next.js, pure frontend)

`dashboard/` has no API routes and no filesystem access of its own — every dynamic
page calls the backend via `dashboard/lib/api.js`, which reads its base URL from
`NEXT_PUBLIC_API_BASE` (see `dashboard/.env.local.example`; defaults to
`http://localhost:8000`). Two pages:
- `/` fetches from `/api/tasks` and `/api/messages` and renders filterable cards, a
  calendar, and a "Day overview" of that day's messages, polling every 8 seconds.
- `/settings` fetches/posts `/api/settings`, shows (as green/red status dots) whether
  `OPENAI_API_KEY` and Gmail credentials are configured, triggers `/api/run`, drives
  the Gmail OAuth flow via `/api/gmail-auth`, and toggles dark mode (a purely
  client-side preference in `localStorage`, not backend state).
