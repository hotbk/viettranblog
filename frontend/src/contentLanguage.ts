import type { ContentLanguage } from './types';

export type LanguagePreference = ContentLanguage | 'ALL';

const STORAGE_KEY = 'content_language';

/** navigator.language starting with 'vi' → VI, everything else → EN (docs/10 §4.3). */
function seedFromBrowser(): LanguagePreference {
  const lang = typeof navigator !== 'undefined' ? navigator.language : '';
  return lang.toLowerCase().startsWith('vi') ? 'VI' : 'EN';
}

function isValid(value: string | null): value is LanguagePreference {
  return value === 'VI' || value === 'EN' || value === 'ALL';
}

/**
 * Reads the reader's persisted language preference, seeding it once from
 * navigator.language on first visit. Never re-derived from the browser after
 * that — a stored preference is the reader's, not the browser's (docs/10 §4.3).
 */
export function getLanguagePreference(): LanguagePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isValid(stored)) return stored;
    const seeded = seedFromBrowser();
    localStorage.setItem(STORAGE_KEY, seeded);
    return seeded;
  } catch {
    // Private browsing / storage disabled — fall back to a browser-derived
    // preference for this page load only, never persisted.
    return seedFromBrowser();
  }
}

export function setLanguagePreference(pref: LanguagePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Private browsing / storage disabled — preference still applies for this page load.
  }
}

/** `ALL` sends nothing — omitted query param means "every language" (docs/10 §4.3). */
export function languageQueryParam(pref: LanguagePreference): ContentLanguage | undefined {
  return pref === 'ALL' ? undefined : pref;
}
