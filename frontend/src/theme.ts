export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tb-theme';

/** Reads the theme currently applied to <html data-theme="...">. */
export function getTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Applies a theme and persists the explicit choice (survives reload, wins over system preference). */
export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing / storage disabled — theme still applies for this page load.
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
