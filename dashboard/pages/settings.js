import { useEffect, useState } from "react";
import Layout from "../components/Layout";

const ENV_ROWS = [
  ["OPENAI_API_KEY", "OpenAI API key (used by the extraction step)"],
  ["GMAIL_CREDENTIALS_FILE", "Gmail OAuth client secret (credentials.json)"],
  ["SLACK_BOT_TOKEN", "Slack bot token"],
  ["SLACK_CHANNEL_ID", "Slack channel ID (env fallback)"],
];

export default function Settings() {
  const [config, setConfig] = useState({ gmailQuery: "", slackChannelId: "", limit: 10 });
  const [env, setEnv] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data.config);
        setEnv(data.env || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
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

  return (
    <Layout>
      <div className="wrap">
        <h1>Settings</h1>
        <p className="sub">
          Saved here to <code>config.json</code> at the repo root and read by{" "}
          <code>run_baseline.py</code> as defaults on its next run (a CLI flag like{" "}
          <code>--gmail-query</code> still overrides whatever is saved here). Secrets
          stay in <code>.env</code> / <code>credentials.json</code> and are never
          edited on this page — only their presence is shown below.
        </p>

        <section>
          <h2>Connection status</h2>
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

        <section>
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
          padding: 24px clamp(16px, 4vw, 48px) 48px;
          max-width: 640px;
        }
        h1 {
          margin: 0 0 8px;
          font-size: 1.5rem;
        }
        .sub {
          color: var(--muted);
          font-size: 0.88rem;
          line-height: 1.6;
        }
        .sub code {
          background: var(--gray-bg);
          padding: 1px 5px;
          border-radius: 4px;
        }
        section {
          margin-top: 28px;
        }
        h2 {
          font-size: 1.05rem;
          margin: 0 0 12px;
        }
        .status-grid {
          display: grid;
          gap: 10px;
        }
        .status-row {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 0.85rem;
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dot.ok {
          background: var(--green);
        }
        .dot.missing {
          background: var(--red);
        }
        .key {
          color: var(--muted);
          font-size: 0.75rem;
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
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text);
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        button {
          align-self: flex-start;
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 18px;
          font-size: 0.9rem;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .saved {
          color: var(--green);
          font-size: 0.82rem;
        }
      `}</style>
    </Layout>
  );
}
