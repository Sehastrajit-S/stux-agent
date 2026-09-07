import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import { getStoredTheme, setTheme } from "../lib/theme";

const ENV_ROWS = [
  ["OPENAI_API_KEY", "OpenAI API key (used by the extraction step)"],
  ["SLACK_BOT_TOKEN", "Slack bot token"],
  ["SLACK_CHANNEL_ID", "Slack channel ID (env fallback)"],
];

export default function Settings() {
  const [config, setConfig] = useState({ gmailQuery: "", slackChannelId: "", limit: 10 });
  const [env, setEnv] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const [gmail, setGmail] = useState({ connected: false, hasCredentials: false, log: null });
  const [gmailBusy, setGmailBusy] = useState(false);
  const [gmailMessage, setGmailMessage] = useState(null);
  const pollRef = useRef(null);

  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(getStoredTheme() === "dark");
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    setTheme(next ? "dark" : "light");
  }

  const loadSettings = () => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data.config);
        setEnv(data.env || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const loadGmailStatus = () =>
    fetch("/api/gmail-auth")
      .then((r) => r.json())
      .then((data) => {
        setGmail(data);
        return data;
      });

  useEffect(() => {
    loadSettings();
    loadGmailStatus();
    return () => clearInterval(pollRef.current);
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setSavedAt(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    setConfig(data.config);
    setSaving(false);
    setSavedAt(new Date());
  }

  async function connectGmail() {
    setGmailBusy(true);
    setGmailMessage(null);
    const res = await fetch("/api/gmail-auth", { method: "POST" });
    const data = await res.json();

    if (data.status === "error") {
      setGmailMessage(data.message);
      setGmailBusy(false);
      return;
    }
    if (data.status === "already_connected") {
      setGmailMessage("Already connected.");
      setGmailBusy(false);
      loadGmailStatus();
      return;
    }

    setGmailMessage(data.message || "Opening browser for Google sign-in…");
    clearInterval(pollRef.current);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const status = await loadGmailStatus();
      if (status.connected) {
        clearInterval(pollRef.current);
        setGmailBusy(false);
        setGmailMessage("Connected.");
      } else if (status.log && status.log.includes("GMAIL_AUTH_ERROR")) {
        clearInterval(pollRef.current);
        setGmailBusy(false);
        setGmailMessage(status.log);
      } else if (attempts > 90) {
        clearInterval(pollRef.current);
        setGmailBusy(false);
        setGmailMessage("Timed out waiting for sign-in. Try again.");
      }
    }, 2000);
  }

  return (
    <Layout>
      <div className="wrap">
        <h1>Settings</h1>

        <section className="panel">
          <h2>Appearance</h2>
          <div className="theme-row">
            <div className="theme-label">Dark mode</div>
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              className={`switch${dark ? " on" : ""}`}
              onClick={toggleDark}
            >
              <span className="switch-knob" />
            </button>
          </div>
        </section>

        <section className="panel">
          <h2>Gmail connection</h2>
          <div className="status-row">
            <span className={`dot ${gmail.hasCredentials ? "ok" : "missing"}`} />
            <div>
              <div>OAuth client secret</div>
              <code className="key">credentials.json</code>
            </div>
          </div>
          <div className="status-row">
            <span className={`dot ${gmail.connected ? "ok" : "missing"}`} />
            <div>
              <div>{gmail.connected ? "Connected" : "Not connected"}</div>
              <code className="key">token.json</code>
            </div>
          </div>
          <div className="gmail-actions">
            <button
              type="button"
              onClick={connectGmail}
              disabled={gmailBusy || gmail.connected || !gmail.hasCredentials}
            >
              {gmail.connected ? "Connected" : gmailBusy ? "Waiting for sign-in…" : "Connect Gmail"}
            </button>
            {!gmail.hasCredentials && (
              <span className="hint">Add credentials.json to the repo root first.</span>
            )}
          </div>
          {gmailMessage && <div className="gmail-message">{gmailMessage}</div>}
        </section>

        <section className="panel">
          <h2>Other connections</h2>
          <div className="status-grid">
            {ENV_ROWS.map(([key, label]) => (
              <div className="status-row" key={key}>
                <span className={`dot ${env[key] ? "ok" : "missing"}`} />
                <div>
                  <div>{label}</div>
                  <code className="key">{key}</code>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Extraction settings</h2>
          {loading ? (
            <p className="sub">Loading…</p>
          ) : (
            <form onSubmit={save}>
              <label>
                Gmail search query
                <input
                  type="text"
                  placeholder="from:notifications@instructure.com"
                  value={config.gmailQuery}
                  onChange={(e) => setConfig({ ...config, gmailQuery: e.target.value })}
                />
              </label>
              <label>
                Slack channel ID
                <input
                  type="text"
                  placeholder="C0123456789"
                  value={config.slackChannelId}
                  onChange={(e) => setConfig({ ...config, slackChannelId: e.target.value })}
                />
              </label>
              <label>
                Messages per source (limit)
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={config.limit}
                  onChange={(e) => setConfig({ ...config, limit: e.target.value })}
                />
              </label>
              <div className="actions">
                <button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
                {savedAt && <span className="saved">Saved {savedAt.toLocaleTimeString()}</span>}
              </div>
            </form>
          )}
        </section>
      </div>

      <style jsx>{`
        .wrap {
          padding: 32px clamp(16px, 4vw, 48px) 48px;
          max-width: 640px;
        }
        h1 {
          margin: 0 0 8px;
          font-size: 1.7rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .sub {
          color: var(--muted);
          font-size: 0.88rem;
          line-height: 1.6;
        }
        .sub code {
          background: var(--surface-muted);
          color: var(--text);
          padding: 1px 6px;
          border-radius: 6px;
        }
        .panel {
          margin-top: 20px;
          padding: 20px 22px;
          background: var(--glass);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow);
          border-radius: 20px;
        }
        h2 {
          font-size: 1.02rem;
          margin: 0 0 14px;
          font-weight: 700;
        }
        .status-grid {
          display: grid;
          gap: 10px;
        }
        .status-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          font-size: 0.85rem;
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dot.ok {
          background: var(--accent-strong);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .dot.missing {
          background: var(--red);
        }
        .key {
          color: var(--muted);
          font-size: 0.75rem;
        }
        .theme-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .theme-label {
          font-size: 0.9rem;
          font-weight: 600;
        }
        .switch {
          flex-shrink: 0;
          width: 44px;
          height: 26px;
          border-radius: 999px;
          border: none;
          background: var(--surface-muted);
          position: relative;
          cursor: pointer;
          transition: background 0.15s ease;
          padding: 0;
        }
        .switch.on {
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
        }
        .switch-knob {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          box-shadow: var(--shadow-sm);
          transition: transform 0.15s ease;
        }
        .switch.on .switch-knob {
          transform: translateX(18px);
        }
        .gmail-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 12px;
        }
        .hint {
          color: var(--muted);
          font-size: 0.8rem;
        }
        .gmail-message {
          margin-top: 10px;
          font-size: 0.82rem;
          color: var(--muted);
          background: var(--surface-muted);
          padding: 8px 12px;
          border-radius: 10px;
          white-space: pre-wrap;
        }
        form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.85rem;
          color: var(--muted);
        }
        input {
          font-size: 0.9rem;
          padding: 9px 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--glass);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          color: var(--text);
        }
        input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        button {
          align-self: flex-start;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 9px 20px;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          transition: transform 0.12s ease;
        }
        button:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        button:disabled {
          opacity: 0.55;
          cursor: default;
          transform: none;
        }
        .saved {
          color: var(--accent-strong);
          font-size: 0.82rem;
        }
      `}</style>
    </Layout>
  );
}
