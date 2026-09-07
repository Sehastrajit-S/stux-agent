# Configuration

This baseline is configured entirely through environment variables. Copy `.env.example`
(repo root) to `.env` and fill in your values, or export them in your shell.

**Required for every run** (used by `src/extractor.py`):
- `OPENAI_API_KEY` — OpenAI API key for the single-call extraction step.
- `OPENAI_MODEL` (optional, defaults to `gpt-4o-mini`).

**Only required for `--source gmail` / `--source all`:**
- `GMAIL_CREDENTIALS_PATH` (default `credentials.json`) — OAuth client secret JSON
  downloaded from Google Cloud Console (Gmail API enabled, "Desktop app" credential type).
- `GMAIL_TOKEN_PATH` (default `token.json`) — created automatically the first time you
  complete the interactive OAuth consent flow (opens a browser).

**Only required for `--source slack` / `--source all`:**
- `SLACK_BOT_TOKEN` — a Slack bot token (`xoxb-...`) with the `channels:history` scope,
  installed in your workspace and invited into the target channel.
- `SLACK_CHANNEL_ID` — the channel to read from (or pass `--slack-channel` instead).

**No credentials needed for the default run.** `--source sample` (the default) reads
the fixture messages in `examples/sample_gmail_messages.json` and
`examples/sample_slack_messages.json`, which mirror the shape the live clients produce.
This is the mode used for the reproducibility test case in the README.
