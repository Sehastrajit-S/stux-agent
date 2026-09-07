import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "..");
const CONFIG_PATH = path.join(ROOT, "config.json");
const ENV_PATH = path.join(ROOT, ".env");

const DEFAULTS = {
  gmailQuery: "from:notifications@instructure.com",
  slackChannelId: "",
  limit: 10,
};

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

// Reports only whether a key is present/non-empty in .env — never returns values.
function readEnvStatus() {
  const keys = ["OPENAI_API_KEY", "GMAIL_CREDENTIALS_PATH", "SLACK_BOT_TOKEN", "SLACK_CHANNEL_ID"];
  let text = "";
  try {
    text = fs.readFileSync(ENV_PATH, "utf-8");
  } catch {
    // no .env file yet
  }
  const status = {};
  for (const key of keys) {
    const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
    status[key] = Boolean(match && match[1].trim());
  }
  status.GMAIL_CREDENTIALS_FILE = fs.existsSync(path.join(ROOT, "credentials.json"));
  return status;
}

export default function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ config: readConfig(), env: readEnvStatus() });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const limit = Number(body.limit);
    const next = {
      gmailQuery:
        typeof body.gmailQuery === "string" && body.gmailQuery.trim()
          ? body.gmailQuery.trim()
          : DEFAULTS.gmailQuery,
      slackChannelId: typeof body.slackChannelId === "string" ? body.slackChannelId.trim() : "",
      limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULTS.limit,
    };
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
    return res.status(200).json({ config: next });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
