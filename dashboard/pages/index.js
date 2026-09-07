import { useEffect, useState, useCallback, useMemo } from "react";

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

export default function Home() {
  const [records, setRecords] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

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
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

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
    <div>
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

      <style jsx>{`
        .header {
          padding: 24px clamp(16px, 4vw, 48px) 8px;
        }
        h1 {
          margin: 0 0 4px;
          font-size: 1.5rem;
        }
        .sub {
          color: var(--muted);
          font-size: 0.9rem;
        }
        .stats {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          padding: 16px clamp(16px, 4vw, 48px);
        }
        .stat {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 16px;
          min-width: 96px;
        }
        .stat .n {
          font-size: 1.4rem;
          font-weight: 700;
        }
        .stat .l {
          font-size: 0.78rem;
          color: var(--muted);
        }
        .filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding: 0 clamp(16px, 4vw, 48px) 16px;
        }
        .chip {
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--text);
          border-radius: 999px;
          padding: 6px 14px;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .chip.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }
        .cards {
          padding: 0 clamp(16px, 4vw, 48px) 48px;
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        }
        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px 16px;
        }
        .card h3 {
          margin: 0;
          font-size: 1rem;
        }
        .badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin: 8px 0;
        }
        .badge {
          font-size: 0.72rem;
          padding: 2px 8px;
          border-radius: 999px;
          font-weight: 600;
          white-space: nowrap;
        }
        .badge.type {
          background: var(--gray-bg);
          color: var(--muted);
        }
        .badge.course {
          background: #dbeafe;
          color: #1e40af;
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
          background: var(--green-bg);
          color: var(--green);
        }
        .badge.due-none {
          background: var(--gray-bg);
          color: var(--muted);
        }
        .summary {
          color: var(--muted);
          font-size: 0.85rem;
          margin-top: 6px;
        }
        .source {
          color: var(--muted);
          font-size: 0.75rem;
          margin-top: 10px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .empty {
          color: var(--muted);
          padding: 40px;
          text-align: center;
          grid-column: 1 / -1;
          line-height: 1.6;
        }
        .empty code {
          background: var(--gray-bg);
          padding: 2px 6px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
