import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "./Icons";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_MS = 86400000;

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function Calendar({ records, selectedDate, onSelectDate }) {
  const [mode, setMode] = useState("month");
  const [anchor, setAnchor] = useState(new Date());

  const itemsByDate = useMemo(() => {
    const map = {};
    for (const r of records) {
      if (!r.due_date) continue;
      (map[r.due_date] = map[r.due_date] || []).push(r);
    }
    return map;
  }, [records]);

  const days = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const end = startOfWeek(last);
    const totalDays = Math.round((addDays(end, 6) - start) / DAY_MS) + 1;
    return Array.from({ length: totalDays }, (_, i) => addDays(start, i));
  }, [mode, anchor]);

  const label =
    mode === "week"
      ? `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function shift(delta) {
    setAnchor((prev) =>
      mode === "week"
        ? addDays(prev, delta * 7)
        : new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
    );
  }

  const today = new Date();

  return (
    <div className="calendar">
      <div className="cal-header">
        <div className="cal-title">{label}</div>
        <div className="cal-nav">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous">
            <ChevronLeft />
          </button>
          <button type="button" className="today-btn" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <button type="button" onClick={() => shift(1)} aria-label="Next">
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="cal-mode">
        <button
          type="button"
          className={mode === "month" ? "active" : ""}
          onClick={() => setMode("month")}
        >
          Month
        </button>
        <button
          type="button"
          className={mode === "week" ? "active" : ""}
          onClick={() => setMode("week")}
        >
          Week
        </button>
      </div>

      <div className="cal-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className={`cal-grid ${mode}`}>
        {days.map((day) => {
          const iso = isoDate(day);
          const items = itemsByDate[iso] || [];
          const inMonth = mode === "week" || day.getMonth() === anchor.getMonth();
          const isToday = sameDay(day, today);
          const isSelected = selectedDate === iso;
          return (
            <button
              type="button"
              key={iso}
              className={`cal-day${inMonth ? "" : " dim"}${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
              onClick={() => onSelectDate(isSelected ? null : iso)}
            >
              <span className="day-num">{day.getDate()}</span>
              {mode === "month" && items.length > 0 && (
                <span className="day-dots">
                  {items.slice(0, 4).map((_, i) => (
                    <span key={i} className="dd" />
                  ))}
                </span>
              )}
              {mode === "week" &&
                items.slice(0, 3).map((it, i) => (
                  <span key={i} className="week-item">
                    {it.title}
                  </span>
                ))}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <button type="button" className="clear-filter" onClick={() => onSelectDate(null)}>
          Clear date filter ({selectedDate})
        </button>
      )}

      <style jsx>{`
        .calendar {
          background: var(--glass);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow);
          border-radius: 20px;
          padding: 18px 18px 14px;
        }
        .cal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .cal-title {
          font-weight: 700;
          font-size: 0.95rem;
        }
        .cal-nav {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .cal-nav button {
          background: none;
          border: none;
          color: var(--muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 8px;
        }
        .cal-nav button:hover {
          background: var(--surface-muted);
          color: var(--text);
        }
        .today-btn {
          font-size: 0.72rem !important;
          padding: 4px 8px !important;
          width: auto !important;
        }
        .cal-mode {
          display: flex;
          gap: 6px;
          margin-bottom: 12px;
        }
        .cal-mode button {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted);
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 0.75rem;
          cursor: pointer;
        }
        .cal-mode button.active {
          background: var(--accent-soft);
          color: var(--accent-strong);
          border-color: transparent;
        }
        .cal-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          font-size: 0.68rem;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .cal-grid.month .cal-day {
          aspect-ratio: 1;
        }
        .cal-grid.week .cal-day {
          min-height: 88px;
          align-items: flex-start;
          padding-top: 6px;
        }
        .cal-day {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          cursor: pointer;
          font-size: 0.78rem;
          color: var(--text);
          padding: 2px;
          overflow: hidden;
        }
        .cal-day:hover {
          background: var(--surface-muted);
        }
        .cal-day.dim {
          color: var(--muted);
          opacity: 0.4;
        }
        .cal-day.today .day-num {
          background: var(--accent);
          color: #fff;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cal-day.selected {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .day-dots {
          display: flex;
          gap: 2px;
        }
        .dd {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--accent);
        }
        .week-item {
          font-size: 0.62rem;
          background: var(--accent-soft);
          color: var(--accent-strong);
          border-radius: 5px;
          padding: 1px 4px;
          width: 100%;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .clear-filter {
          margin-top: 12px;
          width: 100%;
          background: var(--surface-muted);
          border: none;
          border-radius: 10px;
          padding: 7px;
          font-size: 0.75rem;
          color: var(--muted);
          cursor: pointer;
        }
        .clear-filter:hover {
          color: var(--text);
        }
      `}</style>
    </div>
  );
}
