export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.detail || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export function getTasks() {
  return request("/api/tasks");
}

export function getMessages() {
  return request("/api/messages");
}

export function getSettings() {
  return request("/api/settings");
}

export function saveSettings(config) {
  return request("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

export function getGmailAuthStatus() {
  return request("/api/gmail-auth");
}

export function startGmailAuth() {
  return request("/api/gmail-auth", { method: "POST" });
}

export function triggerRun(body = {}) {
  return request("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
