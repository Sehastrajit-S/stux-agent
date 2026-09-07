import { useEffect, useState, useCallback, useMemo } from "react";
import Layout from "../components/Layout";
import Calendar from "../components/Calendar";
import { MailIcon, SlackIcon } from "../components/Icons";

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

function SourceIcon({ source, ...props }) {
  return source === "slack" ? <SlackIcon {...props} /> : <MailIcon {...props} />;
}

function typeBadges(type) {
  if (type === "both") return ["task", "course"];
  return [type || "unknown"];
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function Home() {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));

  const [allMessages, setAllMessages] = useState([]);
  const [allError, setAllError] = useState(null);
  const [allLoading, setAllLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setRecords(Array.isArray(data.records) ? data.records : []);
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

  const overviewDate = selectedDate || isoDate(new Date());

  const dayMessages = useMemo(() => {
    return allMessages.filter((m) => {
      if (!m.received_at) return false;
      const d = new Date(m.received_at);
      return !Number.isNaN(d.getTime()) && isoDate(d) === overviewDate;
    });
  }, [allMessages, overviewDate]);

  const filtered = useMemo(() => {
    let list = records;
    if (filter === "task" || filter === "course") {
      list = list.filter((r) => r.type === filter || r.type === "both");
    } else if (filter === "gmail" || filter === "slack") {
      list = list.filter((r) => r.source === filter);
    }
    if (selectedDate) {
      list = list.filter((r) => r.due_date === selectedDate);
    }
    return list;
  }, [records, filter, selectedDate]);

  return (
    <Layout>
      <div className="layout-grid">
        <aside className="left-col">
          <Calendar records={records} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </aside>

        <div className="right-col">
          <div className="list-context">
            <span>
              {selectedDate
                ? `Due ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}`
                : "All upcoming tasks"}
            </span>
            {selectedDate && (
              <button type="button" className="clear-link" onClick={() => setSelectedDate(null)}>
                Show all
              </button>
            )}
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
                    {typeBadges(r.type).map((t) => (
                      <span className="badge type" key={t}>
                        {t}
                      </span>
                    ))}
                    {r.course_code && <span className="badge course">{r.course_code}</span>}
                    <span className={`badge ${status.cls}`}>{status.label}</span>
                    {r.priority && <span className="badge type">{r.priority} priority</span>}
                  </div>
                  {r.summary && <div className="summary">{r.summary}</div>}
                  <div className="source">
                    <SourceIcon source={r.source} />
                    {r.source}
                  </div>
                </div>
              );
            })}
          </main>
        </div>
      </div>

      <section className="activity">
        <div className="activity-head">
          <h2>Day overview</h2>
          <span className="activity-date">
            {new Date(`${overviewDate}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        {allLoading && <div className="empty">Loading…</div>}
        {!allLoading && allError === "not_found" && (
          <div className="empty">
            No run has recorded raw messages yet. This appears after your next{" "}
            <code>python run_baseline.py</code> run.
          </div>
        )}
        {!allLoading && !allError && dayMessages.length === 0 && (
          <div className="empty">
            No messages fetched on this day in the most recent run. Pick a different day
            on the calendar, or check the Gmail query on the Settings page.
          </div>
        )}
        {dayMessages.map((m, i) => (
          <div className="activity-row" key={`${m.source}-${m.source_id}-${i}`}>
            <span
              className={`dot ${m.is_relevant ? "ok" : "off"}`}
              title={m.is_relevant ? "relevant" : "not relevant"}
            />
            <div className="activity-body">
              <div className="activity-top">
                <span className="activity-subject">{m.subject || "(no subject)"}</span>
                <span className="activity-time">
                  {m.received_at ? new Date(m.received_at).toLocaleString() : ""}
                </span>
              </div>
              <div className="activity-meta">
                <SourceIcon source={m.source} />
                {m.source} · {m.sender || "unknown sender"}
              </div>
              {m.is_relevant && (
                <div className="activity-tags">
                  {typeBadges(m.type).map((t) => (
                    <span className="badge type" key={t}>
                      {t}
                    </span>
                  ))}
                  {m.course_code && <span className="badge course">{m.course_code}</span>}
                  {m.due_date && <span className="badge due-later">due {m.due_date}</span>}
                </div>
              )}
              {m.summary && <div className="activity-summary">{m.summary}</div>}
            </div>
          </div>
        ))}
      </section>

      <style jsx>{`
        .layout-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          align-items: start;
          padding: 24px clamp(16px, 4vw, 48px) 0;
        }
        @media (max-width: 860px) {
          .layout-grid {
            grid-template-columns: 1fr;
          }
        }
        .left-col {
          position: sticky;
          top: 128px;
        }
        @media (max-width: 860px) {
          .left-col {
            position: static;
          }
        }
        .right-col {
          min-width: 0;
        }
        .list-context {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .clear-link {
          background: none;
          border: none;
          color: var(--accent-strong);
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          padding: 2px 6px;
        }
        .clear-link:hover {
          text-decoration: underline;
        }
        .filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding-bottom: 20px;
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
          padding-bottom: 24px;
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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
          display: flex;
          align-items: center;
          gap: 6px;
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
          margin: 20px clamp(16px, 4vw, 48px) 40px;
          padding: 20px 22px 8px;
          background: var(--glass);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow);
          border-radius: 20px;
        }
        .activity-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .activity h2 {
          font-size: 1.05rem;
          margin: 0;
          font-weight: 700;
        }
        .activity-date {
          color: var(--muted);
          font-size: 0.82rem;
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
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--muted);
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-top: 2px;
        }
        .activity-tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 6px;
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
