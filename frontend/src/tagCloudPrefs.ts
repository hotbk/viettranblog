/**
 * Whether the homepage's tag cloud (App.tsx / TagCloud.tsx) is shown. Same
 * per-browser localStorage persistence pattern as theme.ts/readingPrefs.ts —
 * try/catch so private browsing / storage disabled just falls back to the
 * default (shown) for that page load.
 */

const SHOW_TAG_CLOUD_KEY = 'tb-show-tag-cloud';

export function getShowTagCloud(): boolean {
  try {
    const stored = localStorage.getItem(SHOW_TAG_CLOUD_KEY);
    return stored === null ? true : stored === '1';
  } catch {
    return true;
  }
}

export function setShowTagCloud(show: boolean): void {
  try {
    localStorage.setItem(SHOW_TAG_CLOUD_KEY, show ? '1' : '0');
  } catch {
    // ignore — preference just won't survive reload
  }
}
