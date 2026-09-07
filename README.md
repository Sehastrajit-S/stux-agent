# Stux Agent — Task & Course Extraction from Email and Slack

A single-call OpenAI baseline that reads recent Canvas (Instructure) notification
emails and Slack messages and extracts structured tasks (assignments, deadlines) and
course facts (registration, meeting times, office hours) into one consolidated, sorted
list — viewable as JSON or as a local HTML dashboard.

## What it does

1. Loads messages from a source: bundled sample fixtures (default, no credentials needed),
   live Gmail filtered to `from:notifications@instructure.com` (OAuth), live Slack (bot
   token), or all three.
2. Normalizes each message to `{source, sender, subject/channel, text}`.
3. Sends each message's text to an OpenAI model (one API call per message,
   [src/extractor.py](src/extractor.py)) with a fixed prompt asking it to return a single
   JSON object: is this relevant, and if so what's the title / course code / due date /
   priority.
4. Filters to relevant items, sorts by due date, writes `output/tasks_and_courses.json`,
   prints a human-readable summary to stdout, and generates `output/dashboard.html` — a
   self-contained, filterable dashboard (no server needed, just open it in a browser).

## Files

- `run_baseline.py` — CLI entry point.
- `src/extractor.py` — the single OpenAI API call that does the extraction.
- `src/gmail_client.py` — live Gmail ingestion via the Gmail API (OAuth2), filtered by
  Gmail search query (defaults to Canvas/Instructure notification emails).
- `src/slack_client.py` — live Slack ingestion via `conversations.history`.
- `src/dashboard.py` — renders the extracted records as a self-contained HTML dashboard.
- `examples/sample_gmail_messages.json`, `examples/sample_slack_messages.json` — fixture
  messages (mirroring the live clients' output shape) used for the reproducible test case.
- `examples/readme.md` — configuration / environment variable reference (the
  "Configuration location" for this project).
- `proposal/CSE598_Capstone_Proposal.md` — the capstone proposal document.

## Setup

Requires Python 3.10+.

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then fill in OPENAI_API_KEY at minimum
```

### Required API keys / environment variables

See [examples/readme.md](examples/readme.md) for the full reference. Short version:

| Variable | Required for | Notes |
|---|---|---|
| `OPENAI_API_KEY` | every run | [platform.openai.com](https://platform.openai.com) |
| `OPENAI_MODEL` | optional | defaults to `gpt-4o-mini` |
| `GMAIL_CREDENTIALS_PATH`, `GMAIL_TOKEN_PATH` | `--source gmail`/`all` only | OAuth client secret from Google Cloud Console |
| `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID` | `--source slack`/`all` only | bot token needs `channels:history`, must be invited to the channel |

**The default run needs only `OPENAI_API_KEY`.** Gmail/Slack credentials are only
needed if you explicitly ask for a live source.

## Running the baseline

Reproducible test case — no Gmail/Slack credentials needed, just `OPENAI_API_KEY`:

```bash
python run_baseline.py --source sample
```

- **Input**: `examples/sample_gmail_messages.json` + `examples/sample_slack_messages.json`
  (7 messages total: 4 email, 3 Slack).
- **Output**: printed summary on stdout, structured results written to
  `output/tasks_and_courses.json`, and a browsable dashboard at `output/dashboard.html`.

Live sources (optional, requires the corresponding credentials above):

```bash
python run_baseline.py --source gmail --limit 10
python run_baseline.py --source gmail --gmail-query "from:notifications@instructure.com"
python run_baseline.py --source slack --slack-channel C0123456789 --limit 10
python run_baseline.py --source all
```

## Known setup limitations

- The first live Gmail run opens a browser window for OAuth consent; this will not work
  in a headless environment without port forwarding.
- The Slack bot must be invited to the target channel (`/invite @your-bot`) before
  `conversations.history` can read it.
- The model's date/relevance judgments are not guaranteed correct — see Section 7 of the
  proposal for known failure modes.
