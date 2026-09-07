# Configuration

This baseline is configured entirely through environment variables. Copy `.env.example`
(repo root) to `.env` and fill in your values, or export them in your shell. The
backend (`backend/main.py`) loads this same `.env` file, since it's the process that
actually talks to Gmail and OpenAI — the dashboard never touches these values.

**Required for every run:**
- `OPENAI_API_KEY` — OpenAI API key for the single-call extraction step (used by
  `backend/services/extractor.py`).
- `OPENAI_MODEL` (optional, defaults to `gpt-4o-mini`).
- `GMAIL_CREDENTIALS_PATH` (default `credentials.json`) — OAuth client secret JSON
  downloaded from Google Cloud Console (Gmail API enabled, "Desktop app" credential type).
- `GMAIL_TOKEN_PATH` (default `token.json`) — created automatically the first time you
  complete the interactive OAuth consent flow (opens a browser, or use the "Connect
  Gmail" button on the dashboard's Settings page, which asks the backend to run it).
  The flow requests the Gmail-readonly, Tasks, and Calendar-events scopes together
  in one consent screen (`backend/services/google_auth.py`), since pushing extracted
  records needs write access to both Tasks and Calendar. If a token was created
  before a scope was added, the backend detects the gap automatically and re-prompts
  for consent (covering every scope at once) rather than failing silently — the
  **Google Tasks API** and **Google Calendar API** each also need to be enabled for
  your Cloud project (Cloud Console → APIs & Services → Library → search each name →
  Enable), the same one-time step as enabling the Gmail API.
- `GMAIL_QUERY` (optional, defaults to `from:notifications@instructure.com`) — Gmail
  search syntax restricting which emails are pulled.

**There is no offline/sample mode.** The backend only reads live Gmail — every run
needs real, current credentials. The OAuth flow opens a browser window on first run;
this step is interactive and must be completed by a person (it cannot be scripted).

## Non-secret settings (`config.json`)

`GMAIL_QUERY` and the message limit can also be set in `config.json` at the repo root
(edited via the dashboard's Settings page, which calls `POST /api/settings` on the
backend, or by hand). A value passed directly in a `POST /api/run` request body
overrides `config.json` for that one run; otherwise `config.json` > built-in default.
This file holds no secrets — only the query string and a number.

## Backend (FastAPI)

`backend/` is the only code that reads `.env`, `credentials.json`, `token.json`,
and `config.json`, and the only code that calls Gmail or OpenAI. Run it with
`uvicorn backend.main:app --reload --port 8000`. It's a small router-per-resource
FastAPI app:
- `backend/routers/tasks.py` — `GET /api/tasks`, `GET /api/messages`, reading
  `output/tasks_and_courses.json` / `output/all_messages.json`.
- `backend/routers/run.py` — `POST /api/run`, runs the fetch-and-extract pipeline
  (`backend/services/pipeline.py`) and rewrites those files.
- `backend/routers/settings.py` — `GET /api/settings`, `POST /api/settings`,
  reading/writing `config.json` and reporting (as booleans, never actual values)
  whether `OPENAI_API_KEY` and Gmail credentials are present.
- `backend/routers/gmail.py` — `GET /api/gmail-auth`, `POST /api/gmail-auth`,
  checking connection status / running the OAuth flow in a background thread.
- `backend/routers/actions.py` — `GET /api/actions/status`, `POST /api/actions/push`
  (one record, by `source_id`), `POST /api/actions/push-all`. For each pushed record,
  `_destination()` decides Task vs. Calendar: a `type: "course"` record with a
  `due_date` becomes a Google Calendar all-day event (exam, class session,
  deadline-as-event); anything else relevant becomes a Google Task with that due
  date attached. Either way the note/description is built by
  `backend/services/notes.py` from the record's `overview` (one sentence) + `steps`
  (checklist), not the raw extraction dump. `backend/services/sync_store.py` tracks
  which `source_id`s were already pushed and to which destination
  (`output/google_actions_sync.json`) so re-pushing — a second click, a re-run —
  never creates duplicates.

CORS is restricted to `http://localhost:3000`. To allow another frontend origin,
adjust `allow_origins` in `backend/main.py`.

With just the backend running (no dashboard needed), open
[http://localhost:8000/docs](http://localhost:8000/docs) for an interactive Swagger
UI that lets you call any of these directly from the browser — routes are grouped by
tag (tasks/run/settings/gmail/actions), matching the router files above.

## Dashboard (Next.js, pure frontend)

`dashboard/` has no API routes and no filesystem access of its own — every dynamic
page calls the backend via `dashboard/lib/api.js`, which reads its base URL from
`NEXT_PUBLIC_API_BASE` (see `dashboard/.env.local.example`; defaults to
`http://localhost:8000`). Two pages:
- `/` fetches from `/api/tasks` and `/api/messages` and renders filterable cards, a
  calendar, and a "Day overview" of that day's messages, polling every 8 seconds.
  Each card (and a bulk "Add all to Tasks/Calendar" action) calls
  `/api/actions/push[-all]` and shows "Added to Google Tasks ✓" or "Added to Google
  Calendar ✓" once synced, matching whichever destination the backend actually used.
- `/settings` fetches/posts `/api/settings`, shows (as green/red status dots) whether
  `OPENAI_API_KEY` and Gmail credentials are configured, triggers `/api/run`, drives
  the Gmail OAuth flow via `/api/gmail-auth`, and toggles dark mode (a purely
  client-side preference in `localStorage`, not backend state).
