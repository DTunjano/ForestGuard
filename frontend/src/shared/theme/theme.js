export const THEME_KEY = "forestguard-theme";

export function validTheme(value) {
  return value === "light" || value === "dark";
}

export function readTheme(storage) {
  try {
    const value = (storage ?? globalThis.localStorage).getItem(THEME_KEY);
    return validTheme(value) ? value : "dark";
  } catch {
    return "dark";
  }
}

export function saveTheme(theme, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(THEME_KEY, theme);
  } catch {
    // Storage may be disabled; switching still works for this visit.
  }
}
