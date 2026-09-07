const KEY = "stux-theme";

export function getStoredTheme() {
  if (typeof window === "undefined") return "light";
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ignore (private browsing, storage disabled, etc.)
  }
  applyTheme(theme);
}
