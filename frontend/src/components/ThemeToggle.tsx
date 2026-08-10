import { useState } from 'react';
import { getTheme, toggleTheme, type Theme } from '../theme';

/**
 * Light/dark mode switch. Reads the theme the blocking script in index.html already
 * applied to <html data-theme>, then flips + persists it on click. The icon shows
 * the mode a click will switch *to* (sun while dark, moon while light).
 */
export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document !== 'undefined' ? getTheme() : 'light'
  );

  function handleClick() {
    setThemeState(toggleTheme());
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleClick}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
          <path
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8l1.8-1.8M18 6l1.8-1.8"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
          />
        </svg>
      )}
    </button>
  );
}
