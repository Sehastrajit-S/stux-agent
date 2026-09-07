# Configuration

This baseline is configured entirely through environment variables. Copy `.env.example`
(repo root) to `.env` and fill in your values, or export them in your shell.

**Required for every run** (used by `src/extractor.py`):
- `OPENAI_API_KEY` — OpenAI API key for the single-call extraction step.
- `OPENAI_MODEL` (optional, defaults to `gpt-4o-mini`).

**Required for `--source gmail` (or `all`):**
- `GMAIL_CREDENTIALS_PATH` (default `credentials.json`) — OAuth client secret JSON
  downloaded from Google Cloud Console (Gmail API enabled, "Desktop app" credential type).
- `GMAIL_TOKEN_PATH` (default `token.json`) — created automatically the first time you
  complete the interactive OAuth consent flow (opens a browser).
- `GMAIL_QUERY` (optional, defaults to `from:notifications@instructure.com`) — Gmail
  search syntax restricting which emails are pulled.

**Required for `--source slack` (or `all`):**
- `SLACK_BOT_TOKEN` — a Slack bot token (`xoxb-...`) with the `channels:history` scope,
  installed in your workspace and invited into the target channel.
- `SLACK_CHANNEL_ID` — the channel to read from (or pass `--slack-channel` instead).

**There is no offline/sample mode.** `run_baseline.py` only reads live Gmail and/or
Slack data — every run needs real, current credentials for whichever source(s) you
pass via `--source`. The Gmail OAuth flow opens a browser window on first run; this
step is interactive and must be completed by a person (it cannot be scripted).

## Non-secret settings (`config.json`)

`GMAIL_QUERY`, the Slack channel, and the per-source message limit can also be set in
`config.json` at the repo root (edited via the dashboard's Settings page, or by hand).
Precedence is CLI flag > `config.json` > environment variable / built-in default. This
file holds no secrets — only the query string, channel ID, and a number.

## Dashboard (Next.js)

`dashboard/` is a small Next.js app with two pages:
- `/` reads `output/tasks_and_courses.json` (written by `run_baseline.py`) and renders
  it as filterable cards, polling every 8 seconds.
- `/settings` reads and writes `config.json` through `pages/api/settings.js`, and shows
  (as green/red status dots, never the actual values) whether `OPENAI_API_KEY`,
  `GMAIL_CREDENTIALS_PATH`/`credentials.json`, and `SLACK_BOT_TOKEN` are configured.

To point the dashboard at a different output file, set `OUTPUT_JSON_PATH` before
`npm run dev`.
