import json
from datetime import datetime, timezone
from pathlib import Path

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tasks &amp; Courses Dashboard</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f6f7f9; --card: #ffffff; --text: #1a1d23; --muted: #6b7280;
    --border: #e5e7eb; --accent: #2563eb;
    --red: #dc2626; --red-bg: #fee2e2;
    --orange: #d97706; --orange-bg: #fef3c7;
    --green: #16a34a; --green-bg: #dcfce7;
    --gray-bg: #f3f4f6;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14161a; --card: #1e2128; --text: #e5e7eb; --muted: #9aa1ac;
      --border: #2c2f36; --gray-bg: #262a31;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  header { padding: 24px clamp(16px, 4vw, 48px) 8px; }
  h1 { margin: 0 0 4px; font-size: 1.5rem; }
  .sub { color: var(--muted); font-size: 0.9rem; }
  .stats { display: flex; gap: 12px; flex-wrap: wrap; padding: 16px clamp(16px, 4vw, 48px); }
  .stat { background: var(--card); border: 1px solid var(--border); border-radius: 10px;
    padding: 10px 16px; min-width: 96px; }
  .stat .n { font-size: 1.4rem; font-weight: 700; }
  .stat .l { font-size: 0.78rem; color: var(--muted); }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 clamp(16px, 4vw, 48px) 16px; }
  .chip { border: 1px solid var(--border); background: var(--card); color: var(--text);
    border-radius: 999px; padding: 6px 14px; font-size: 0.85rem; cursor: pointer; }
  .chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  main { padding: 0 clamp(16px, 4vw, 48px) 48px; display: grid; gap: 10px;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 16px; }
  .card .top { display: flex; justify-content: space-between; align-items: start; gap: 8px; }
  .card h3 { margin: 0; font-size: 1rem; }
  .badges { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
  .badge { font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; font-weight: 600;
    white-space: nowrap; }
  .badge.type { background: var(--gray-bg); color: var(--muted); }
  .badge.course { background: #dbeafe; color: #1e40af; }
  .badge.due-overdue { background: var(--red-bg); color: var(--red); }
  .badge.due-soon { background: var(--orange-bg); color: var(--orange); }
  .badge.due-later { background: var(--green-bg); color: var(--green); }
  .badge.due-none { background: var(--gray-bg); color: var(--muted); }
  .summary { color: var(--muted); font-size: 0.85rem; margin-top: 6px; }
  .source { color: var(--muted); font-size: 0.75rem; margin-top: 10px; text-transform: uppercase;
    letter-spacing: 0.03em; }
  .empty { color: var(--muted); padding: 40px; text-align: center; grid-column: 1 / -1; }
</style>
</head>
<body>
<header>
  <h1>Tasks &amp; Courses Dashboard</h1>
  <div class="sub" id="generated"></div>
</header>
<div class="stats" id="stats"></div>
<div class="filters" id="filters"></div>
<main id="cards"></main>
<script>
const RECORDS = __DATA__;
const GENERATED_AT = "__GENERATED_AT__";

function dueStatus(dateStr) {
  if (!dateStr) return { cls: "due-none", label: "no date" };
  const due = new Date(dateStr + "T00:00:00");
  if (isNaN(due)) return { cls: "due-none", label: dateStr };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return { cls: "due-overdue", label: `overdue (${dateStr})` };
  if (days <= 7) return { cls: "due-soon", label: `due ${dateStr} (${days}d)` };
  return { cls: "due-later", label: `due ${dateStr}` };
}

let activeFilter = "all";

function matchesFilter(r) {
  if (activeFilter === "all") return true;
  if (activeFilter === "task" || activeFilter === "course") return r.type === activeFilter || r.type === "both";
  if (activeFilter === "gmail" || activeFilter === "slack") return r.source === activeFilter;
  return true;
}

function render() {
  const cards = document.getElementById("cards");
  const filtered = RECORDS.filter(matchesFilter);
  cards.innerHTML = "";
  if (filtered.length === 0) {
    cards.innerHTML = '<div class="empty">No items match this filter.</div>';
    return;
  }
  for (const r of filtered) {
    const status = dueStatus(r.due_date);
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="top"><h3>${escapeHtml(r.title || "(untitled)")}</h3></div>
      <div class="badges">
        <span class="badge type">${escapeHtml(r.type || "unknown")}</span>
        ${r.course_code ? `<span class="badge course">${escapeHtml(r.course_code)}</span>` : ""}
        <span class="badge ${status.cls}">${escapeHtml(status.label)}</span>
        ${r.priority ? `<span class="badge type">${escapeHtml(r.priority)} priority</span>` : ""}
      </div>
      ${r.summary ? `<div class="summary">${escapeHtml(r.summary)}</div>` : ""}
      <div class="source">${escapeHtml(r.source || "")}</div>
    `;
    cards.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function renderStats() {
  const total = RECORDS.length;
  const tasks = RECORDS.filter(r => r.type === "task" || r.type === "both").length;
  const courses = RECORDS.filter(r => r.type === "course" || r.type === "both").length;
  const overdue = RECORDS.filter(r => dueStatus(r.due_date).cls === "due-overdue").length;
  const soon = RECORDS.filter(r => dueStatus(r.due_date).cls === "due-soon").length;
  const stats = [
    ["Total", total], ["Tasks", tasks], ["Courses", courses],
    ["Overdue", overdue], ["Due ≤ 7d", soon],
  ];
  document.getElementById("stats").innerHTML = stats.map(([l, n]) =>
    `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`
  ).join("");
}

function renderFilters() {
  const options = [
    ["all", "All"], ["task", "Tasks"], ["course", "Courses"],
    ["gmail", "Gmail"], ["slack", "Slack"],
  ];
  const el = document.getElementById("filters");
  el.innerHTML = options.map(([v, l]) =>
    `<button class="chip${v === activeFilter ? " active" : ""}" data-v="${v}">${l}</button>`
  ).join("");
  el.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.v;
      renderFilters();
      render();
    });
  });
}

document.getElementById("generated").textContent =
  `${RECORDS.length} item(s) · generated ${GENERATED_AT}`;
renderStats();
renderFilters();
render();
</script>
</body>
</html>
"""


def generate_dashboard(records: list, output_path: Path) -> None:
    """Write a self-contained HTML dashboard (data embedded, no server needed)."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    html = TEMPLATE.replace("__DATA__", json.dumps(records)).replace(
        "__GENERATED_AT__", generated_at
    )
    output_path.write_text(html, encoding="utf-8")
