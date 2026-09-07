import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "./Icons";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_MS = 86400000;
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM - 11 PM

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

function formatHour(h) {
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${period}`;
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
      : mode === "day"
      ? anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
      : anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function shift(delta) {
    setAnchor((prev) => {
      const next =
        mode === "week"
          ? addDays(prev, delta * 7)
          : mode === "day"
          ? addDays(prev, delta)
          : new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      if (mode === "day") onSelectDate(isoDate(next));
      return next;
    });
  }

  function selectMode(next) {
    setMode(next);
    if (next === "day") onSelectDate(isoDate(anchor));
  }

  function goToday() {
    const now = new Date();
    setAnchor(now);
    if (mode === "day") onSelectDate(isoDate(now));
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
          <button type="button" className="today-btn" onClick={goToday}>
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
          onClick={() => selectMode("month")}
        >
          Month
        </button>
        <button
          type="button"
          className={mode === "week" ? "active" : ""}
          onClick={() => selectMode("week")}
        >
          Week
        </button>
        <button
          type="button"
          className={mode === "day" ? "active" : ""}
          onClick={() => selectMode("day")}
        >
          Day
        </button>
      </div>

      {mode === "month" && (
        <>
          <div className="cal-weekdays">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="cal-grid">
            {days.map((day) => {
              const iso = isoDate(day);
              const items = itemsByDate[iso] || [];
              const inMonth = day.getMonth() === anchor.getMonth();
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
                  {items.length > 0 && (
                    <span className="day-dots">
                      {items.slice(0, 4).map((_, i) => (
                        <span key={i} className="dd" />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mode === "week" && (
        <div className="week-agenda">
          <div className="week-row week-head-row">
            <div className="time-gutter" />
            {days.map((day) => {
              const iso = isoDate(day);
              const isToday = sameDay(day, today);
              const isSelected = selectedDate === iso;
              return (
                <button
                  type="button"
                  key={iso}
                  className={`week-day-head${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
                  onClick={() => onSelectDate(isSelected ? null : iso)}
                >
                  <span className="wd-name">{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <span className="wd-num">{day.getDate()}</span>
                </button>
              );
            })}
          </div>

          <div className="week-row week-allday-row">
            <div className="time-gutter small">All day</div>
            {days.map((day) => {
              const iso = isoDate(day);
              const items = itemsByDate[iso] || [];
              return (
                <div className="week-allday-cell" key={iso}>
                  {items.map((it, i) => (
                    <span key={i} className="week-item" title={it.title}>
                      {it.title}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="week-hours">
            {HOURS.map((h) => (
              <div className="week-row hour-row" key={h}>
                <div className="time-gutter hour-label">{formatHour(h)}</div>
                {days.map((day) => (
                  <div className="hour-cell" key={isoDate(day) + h} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "day" && (
        <div className="week-agenda">
          <div className="week-row single week-head-row">
            <div className="time-gutter" />
            <div className={`week-day-head no-btn${sameDay(anchor, today) ? " today" : ""}`}>
              <span className="wd-name">{anchor.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span className="wd-num">{anchor.getDate()}</span>
            </div>
          </div>

          <div className="week-row single week-allday-row">
            <div className="time-gutter small">All day</div>
            <div className="week-allday-cell">
              {(itemsByDate[isoDate(anchor)] || []).length === 0 ? (
                <span className="day-empty-inline">Nothing due today</span>
              ) : (
                (itemsByDate[isoDate(anchor)] || []).map((it, i) => (
                  <span key={i} className="week-item" title={it.title}>
                    {it.title}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="week-hours">
            {HOURS.map((h) => (
              <div className="week-row single hour-row" key={h}>
                <div className="time-gutter hour-label">{formatHour(h)}</div>
                <div className="hour-cell" />
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedDate && mode !== "day" && (
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
          font-size: 1rem;
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
          margin-bottom: 14px;
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
          font-size: 0.72rem;
          color: var(--muted);
          margin-bottom: 4px;
        }
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        .cal-day {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          aspect-ratio: 1;
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--text);
          padding: 4px;
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
          width: 24px;
          height: 24px;
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
          gap: 3px;
        }
        .dd {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent);
        }

        .week-agenda {
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }
        .week-row {
          display: grid;
          grid-template-columns: 56px repeat(7, minmax(0, 1fr));
        }
        .week-row.single {
          grid-template-columns: 56px minmax(0, 1fr);
        }
        .time-gutter {
          font-size: 0.68rem;
          color: var(--muted);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 8px;
        }
        .time-gutter.small {
          font-size: 0.65rem;
        }
        .week-head-row {
          border-bottom: 1px solid var(--border);
          background: var(--glass);
          backdrop-filter: blur(14px) saturate(160%);
          -webkit-backdrop-filter: blur(14px) saturate(160%);
        }
        .week-day-head {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 8px 0;
          background: none;
          border: none;
          border-left: 1px solid var(--border);
          cursor: pointer;
          min-width: 0;
          overflow: hidden;
        }
        .week-day-head .wd-name {
          font-size: 0.65rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .week-day-head .wd-num {
          font-size: 0.9rem;
          font-weight: 700;
        }
        .week-day-head.today .wd-num {
          color: var(--accent-strong);
        }
        .week-day-head.selected {
          background: var(--accent-soft);
        }
        .week-day-head.no-btn {
          cursor: default;
        }
        .day-empty-inline {
          color: var(--muted);
          font-size: 0.72rem;
          padding: 4px 2px;
        }
        .week-allday-row {
          border-bottom: 1px solid var(--border);
        }
        .week-allday-cell {
          border-left: 1px solid var(--border);
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-height: 30px;
          min-width: 0;
          overflow: hidden;
        }
        .week-item {
          display: block;
          width: 100%;
          box-sizing: border-box;
          min-width: 0;
          font-size: 0.66rem;
          background: var(--accent-soft);
          color: var(--accent-strong);
          border-radius: 5px;
          padding: 2px 5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: default;
        }
        .week-hours {
          max-height: 480px;
          overflow-y: auto;
        }
        .hour-row {
          height: 34px;
          border-bottom: 1px solid var(--border);
        }
        .hour-label {
          transform: translateY(-8px);
        }
        .hour-cell {
          border-left: 1px solid var(--border);
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
