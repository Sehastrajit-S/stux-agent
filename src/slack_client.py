import os
from datetime import datetime, timezone

from slack_sdk import WebClient


def fetch_recent_messages(channel: str = None, limit: int = 10) -> list:
    """Fetch the most recent messages from a Slack channel and normalize them.

    Requires SLACK_BOT_TOKEN (a bot token with the channels:history scope) and
    either SLACK_CHANNEL_ID or an explicit `channel` argument. The bot must be
    invited to the channel before it can read its history.
    """
    token = os.environ["SLACK_BOT_TOKEN"]
    channel = channel or os.environ["SLACK_CHANNEL_ID"]
    client = WebClient(token=token)
    response = client.conversations_history(channel=channel, limit=limit)
    messages = []
    for m in response.get("messages", []):
        if not m.get("text"):
            continue
        received_at = None
        ts = m.get("ts")
        if ts:
            received_at = datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat()
        messages.append(
            {
                "source": "slack",
                "id": ts,
                "sender": m.get("user", "unknown"),
                "channel": channel,
                "text": m["text"],
                "received_at": received_at,
            }
        )
    return messages
