import { useEffect, useState, useCallback, useMemo } from "react";
import Layout from "../components/Layout";

const FILTERS = [
  ["all", "All"],
  ["task", "Tasks"],
  ["course", "Courses"],
  ["gmail", "Gmail"],
  ["slack", "Slack"],
];

function dueStatus(dateStr) {
  if (!dateStr) return { cls: "due-none", label: "no date" };
  const due = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { cls: "due-none", label: dateStr };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return { cls: "due-overdue", label: `overdue (${dateStr})` };
  if (days <= 7) return { cls: "due-soon", label: `due ${dateStr} (${days}d)` };
  return { cls: "due-later", label: `due ${dateStr}` };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default function Home() {
  const [records, setRecords] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const [allMessages, setAllMessages] = useState([]);
  const [allError, setAllError] = useState(null);
  const [allLoading, setAllLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setRecords(Array.isArray(data.records) ? data.records : []);
      setGeneratedAt(data.generatedAt);
      setError(data.error || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }

    try {
      const res = await fetch("/api/messages");
      const data = await res.json();
      setAllMessages(Array.isArray(data.messages) ? data.messages : []);
      setAllError(data.error || null);
    } catch (err) {
      setAllError(err.message);
    } finally {
      setAllLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const recent = useMemo(() => {
    const cutoff = Date.now() - DAY_MS;
    return allMessages.filter((m) => {
      if (!m.received_at) return false;
      const t = new Date(m.received_at).getTime();
      return !Number.isNaN(t) && t >= cutoff;
    });
  }, [allMessages]);

  const filtered = useMemo(() => {
    if (filter === "all") return records;
    if (filter === "task" || filter === "course") {
      return records.filter((r) => r.type === filter || r.type === "both");
    }
    return records.filter((r) => r.source === filter);
  }, [records, filter]);

  const stats = useMemo(() => {
    const total = records.length;
    const tasks = records.filter((r) => r.type === "task" || r.type === "both").length;
    const courses = records.filter((r) => r.type === "course" || r.type === "both").length;
    const overdue = records.filter((r) => dueStatus(r.due_date).cls === "due-overdue").length;
    const soon = records.filter((r) => dueStatus(r.due_date).cls === "due-soon").length;
    return [
      ["Total", total],
      ["Tasks", tasks],
      ["Courses", courses],
      ["Overdue", overdue],
      ["Due ≤ 7d", soon],
    ];
  }, [records]);

  return (
    <Layout>
      <header className="header">
        <h1>Tasks &amp; Courses Dashboard</h1>
        <div className="sub">
          {loading
            ? "Loading…"
            : `${records.length} item(s)${generatedAt ? ` · last run ${new Date(generatedAt).toLocaleString()}` : ""}`}
        </div>
      </header>

      <div className="stats">
        {stats.map(([label, n]) => (
          <div className="stat" key={label}>
            <div className="n">{n}</div>
            <div className="l">{label}</div>
          </div>
        ))}
      </div>

      <div className="filters">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            className={`chip${filter === value ? " active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <main className="cards">
        {!loading && error === "not_found" && (
          <div className="empty">
            No baseline output found yet.
            <br />
            Run <code>python run_baseline.py --source all</code> from the repo root
            (with Gmail/Slack credentials configured), then this page will pick it up
            automatically within a few seconds.
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty">
            {records.length === 0
              ? "The last baseline run found no relevant tasks or courses."
              : "No items match this filter."}
          </div>
        )}
        {filtered.map((r, i) => {
          const status = dueStatus(r.due_date);
          return (
            <div className="card" key={`${r.source}-${r.source_id}-${i}`}>
              <h3>{r.title || "(untitled)"}</h3>
              <div className="badges">
                <span className="badge type">{r.type || "unknown"}</span>
                {r.course_code && <span className="badge course">{r.course_code}</span>}
                <span className={`badge ${status.cls}`}>{status.label}</span>
                {r.priority && <span className="badge type">{r.priority} priority</span>}
              </div>
              {r.summary && <div className="summary">{r.summary}</div>}
              <div className="source">{r.source}</div>
            </div>
          );
        })}
      </main>

      <section className="activity">
        <h2>Recent Activity (last 24h)</h2>
        <div className="sub">
          Every message fetched on the last run, relevant or not — use this to check
          whether a message actually came through and why it was or wasn't flagged.
        </div>
        {allLoading && <div className="empty">Loading…</div>}
        {!allLoading && allError === "not_found" && (
          <div className="empty">
            No run has recorded raw messages yet. This appears after your next{" "}
            <code>python run_baseline.py</code> run.
          </div>
        )}
        {!allLoading && !allError && recent.length === 0 && (
          <div className="empty">
            No messages from the last 24 hours in the most recent run. If you expected
            one, check the Gmail query on the Settings page and confirm the message is
            in the account/label that query searches.
          </div>
        )}
        {recent.map((m, i) => (
          <div className="activity-row" key={`${m.source}-${m.source_id}-${i}`}>
            <span className={`dot ${m.is_relevant ? "ok" : "off"}`} title={m.is_relevant ? "relevant" : "not relevant"} />
            <div className="activity-body">
              <div className="activity-top">
                <span className="activity-subject">{m.subject || "(no subject)"}</span>
                <span className="activity-time">
                  {m.received_at ? new Date(m.received_at).toLocaleString() : ""}
                </span>
              </div>
              <div className="activity-meta">
                {m.source} · {m.sender || "unknown sender"}
              </div>
              {m.summary && <div className="activity-summary">{m.summary}</div>}
            </div>
          </div>
        ))}
      </section>

      <style jsx>{`
        .header {
          padding: 32px clamp(16px, 4vw, 48px) 8px;
        }
        h1 {
          margin: 0 0 4px;
          font-size: 1.7rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .sub {
          color: var(--muted);
          font-size: 0.9rem;
        }
        .stats {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          padding: 20px clamp(16px, 4vw, 48px);
        }
        .stat {
          background: var(--glass);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow-sm);
          border-radius: 16px;
          padding: 12px 18px;
          min-width: 100px;
        }
        .stat .n {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text);
        }
        .stat .l {
          font-size: 0.76rem;
          color: var(--muted);
        }
        .filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding: 0 clamp(16px, 4vw, 48px) 20px;
        }
        .chip {
          border: 1px solid var(--glass-border);
          background: var(--glass);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          color: var(--text);
          border-radius: 999px;
          padding: 7px 16px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .chip:hover {
          box-shadow: var(--shadow-sm);
        }
        .chip.active {
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          border-color: transparent;
          color: #fff;
          box-shadow: var(--shadow-sm);
        }
        .cards {
          padding: 0 clamp(16px, 4vw, 48px) 40px;
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        }
        .card {
          background: var(--glass);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow);
          border-radius: 18px;
          padding: 16px 18px;
          transition: transform 0.15s ease;
        }
        .card:hover {
          transform: translateY(-2px);
        }
        .card h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
        }
        .badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin: 10px 0;
        }
        .badge {
          font-size: 0.72rem;
          padding: 3px 10px;
          border-radius: 999px;
          font-weight: 600;
          white-space: nowrap;
        }
        .badge.type {
          background: var(--surface-muted);
          color: var(--text);
        }
        .badge.course {
          background: var(--surface-muted);
          color: var(--text);
          border: 1px solid var(--border);
        }
        .badge.due-overdue {
          background: var(--red-bg);
          color: var(--red);
        }
        .badge.due-soon {
          background: var(--orange-bg);
          color: var(--orange);
        }
        .badge.due-later {
          background: var(--accent-soft);
          color: var(--accent-strong);
        }
        .badge.due-none {
          background: var(--surface-muted);
          color: var(--muted);
        }
        .summary {
          color: var(--muted);
          font-size: 0.85rem;
          margin-top: 6px;
          line-height: 1.5;
        }
        .source {
          color: var(--muted);
          font-size: 0.72rem;
          margin-top: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .empty {
          color: var(--muted);
          padding: 40px;
          text-align: center;
          grid-column: 1 / -1;
          line-height: 1.6;
        }
        .empty code {
          background: var(--accent-soft);
          color: var(--accent-strong);
          padding: 2px 6px;
          border-radius: 6px;
        }
        .activity {
          margin: 8px clamp(16px, 4vw, 48px) 40px;
          padding: 20px 22px 8px;
          background: var(--glass);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow);
          border-radius: 20px;
        }
        .activity h2 {
          font-size: 1.05rem;
          margin: 0 0 4px;
          font-weight: 700;
        }
        .activity .sub {
          color: var(--muted);
          font-size: 0.82rem;
          margin-bottom: 14px;
        }
        .activity-row {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
        .activity-row:last-child {
          border-bottom: none;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 6px;
          flex-shrink: 0;
        }
        .dot.ok {
          background: var(--accent-strong);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .dot.off {
          background: var(--muted);
        }
        .activity-body {
          flex: 1;
          min-width: 0;
        }
        .activity-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 0.88rem;
        }
        .activity-subject {
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .activity-time {
          color: var(--muted);
          font-size: 0.78rem;
          white-space: nowrap;
        }
        .activity-meta {
          color: var(--muted);
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-top: 2px;
        }
        .activity-summary {
          color: var(--muted);
          font-size: 0.85rem;
          margin-top: 4px;
        }
      `}</style>
    </Layout>
  );
}
