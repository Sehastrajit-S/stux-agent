import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const ROOT = path.join(process.cwd(), "..");
const TOKEN_PATH = path.join(ROOT, "token.json");
const CREDENTIALS_PATH = path.join(ROOT, "credentials.json");
const SCRIPT_PATH = path.join(ROOT, "src", "gmail_login.py");
const LOG_PATH = path.join(ROOT, ".gmail_auth.log");

function findPython() {
  const candidates = [
    path.join(ROOT, ".venv", "Scripts", "python.exe"), // Windows venv
    path.join(ROOT, ".venv", "bin", "python"), // POSIX venv
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return "python"; // fall back to whatever's on PATH
}

function readLogTail() {
  try {
    const text = fs.readFileSync(LOG_PATH, "utf-8");
    return text.trim().split("\n").slice(-5).join("\n");
  } catch {
    return null;
  }
}

export default function handler(req, res) {
  if (req.method === "GET") {
    const connected = fs.existsSync(TOKEN_PATH);
    return res.status(200).json({
      connected,
      hasCredentials: fs.existsSync(CREDENTIALS_PATH),
      log: readLogTail(),
    });
  }

  if (req.method === "POST") {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      return res.status(200).json({
        status: "error",
        message:
          "credentials.json not found at the repo root. Download your OAuth client secret from Google Cloud Console first.",
      });
    }
    if (fs.existsSync(TOKEN_PATH)) {
      return res.status(200).json({ status: "already_connected" });
    }

    try {
      fs.writeFileSync(LOG_PATH, "");
    } catch {
      // non-fatal
    }

    const python = findPython();
    const logFd = fs.openSync(LOG_PATH, "a");
    const child = spawn(python, [SCRIPT_PATH], {
      cwd: ROOT,
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });
    child.unref();

    return res.status(200).json({
      status: "started",
      message: "A browser window should open — sign in and approve access, then this page will update automatically.",
    });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end();
}
