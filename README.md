# Stux Agent — Task & Course Extraction from Email and Slack

A single-call OpenAI baseline that reads live Canvas (Instructure) notification emails
and Slack messages and extracts structured tasks (assignments, deadlines) and course
facts (enrollment, meeting times, office hours) into one consolidated, sorted list —
viewable as JSON or in a Next.js dashboard.

## What it does

1. Loads messages from live Gmail (filtered to `from:notifications@instructure.com`,
   OAuth) and/or live Slack (bot token), per `--source`.
2. Normalizes each message to `{source, sender, subject/channel, text}`.
3. Sends each message's text to an OpenAI model (one API call per message,
   [src/extractor.py](src/extractor.py)) with a fixed prompt asking it to return a single
   JSON object: is this relevant, and if so what's the title / course code / due date /
   priority.
4. Filters to relevant items, sorts by due date, writes `output/tasks_and_courses.json`,
   and prints a human-readable summary to stdout.
5. The `dashboard/` Next.js app reads that JSON file and renders it live.

There is no bundled sample/offline data — every run reflects your actual inbox/Slack
at the time you run it.

## Files

- `run_baseline.py` — CLI entry point.
- `src/extractor.py` — the single OpenAI API call that does the extraction.
- `src/gmail_client.py` — live Gmail ingestion via the Gmail API (OAuth2), filtered by
  Gmail search query (defaults to Canvas/Instructure notification emails).
- `src/slack_client.py` — live Slack ingestion via `conversations.history`.
- `dashboard/` — Next.js app that reads `output/tasks_and_courses.json` and displays it
  as filterable, due-date-colored cards; auto-refreshes every 8s.
- `examples/readme.md` — configuration / environment variable reference (the
  "Configuration location" for this project).
- `proposal/CSE598_Capstone_Proposal.md` — the capstone proposal document.

## Setup

Requires Python 3.10+ and Node 18+.

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # fill in OPENAI_API_KEY plus Gmail/Slack credentials
```

### Required API keys / environment variables

See [examples/readme.md](examples/readme.md) for the full reference. Short version:

| Variable | Required for | Notes |
|---|---|---|
| `OPENAI_API_KEY` | every run | [platform.openai.com](https://platform.openai.com) |
| `OPENAI_MODEL` | optional | defaults to `gpt-4o-mini` |
| `GMAIL_CREDENTIALS_PATH`, `GMAIL_TOKEN_PATH` | `--source gmail`/`all` | OAuth client secret from Google Cloud Console |
| `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID` | `--source slack`/`all` | bot token needs `channels:history`, must be invited to the channel |

There is no credential-free mode — pick at least one of Gmail or Slack and configure it.

## Running the baseline

```bash
python run_baseline.py --source gmail --limit 10
python run_baseline.py --source slack --slack-channel C0123456789 --limit 10
python run_baseline.py --source all      # both sources, default
```

- **Input**: your live Gmail inbox (filtered by `GMAIL_QUERY`) and/or a live Slack
  channel, fetched fresh on every run.
- **Output**: printed summary on stdout, structured results written to
  `output/tasks_and_courses.json`.

## Running the dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It reads
`../output/tasks_and_courses.json` and polls it every 8 seconds, so re-running
`run_baseline.py` updates the page without a restart. If no output file exists yet it
shows the exact command to run, not placeholder data.

## Known setup limitations

- The first live Gmail run opens a browser window for OAuth consent; this is an
  interactive step a person must complete (it cannot be scripted), and will not work
  in a headless environment without port forwarding.
- The Slack bot must be invited to the target channel (`/invite @your-bot`) before
  `conversations.history` can read it.
- Because there is no bundled sample data, reproducing a specific run requires access
  to the same (or equivalent) Gmail/Slack credentials — see the proposal's Section 5
  for how this affects grading reproducibility.
- The model's date/relevance judgments are not guaranteed correct — see Section 7 of
  the proposal for known failure modes.
