/**
 * Per-browser reading preferences for the post-detail page (font size, and
 * whether the Related Posts sidebar is shown). Same persistence pattern as
 * theme.ts: localStorage with a try/catch so private browsing / storage
 * disabled just falls back to the default for that page load instead of
 * throwing.
 */

export type FontSize = 'sm' | 'md' | 'lg' | 'xl';

const FONT_SIZE_KEY = 'tb-reading-font-size';
const HIDE_RELATED_KEY = 'tb-reading-hide-related';

const FONT_SIZE_ORDER: FontSize[] = ['sm', 'md', 'lg', 'xl'];
const FONT_SIZE_PX: Record<FontSize, number> = { sm: 15, md: 17, lg: 19, xl: 21 };
export const FONT_SIZE_LABEL: Record<FontSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' };

export function fontSizePx(size: FontSize): number {
  return FONT_SIZE_PX[size];
}

/** Clamped step: 'inc' past 'xl' or 'dec' past 'sm' is a no-op, not a wrap-around. */
export function stepFontSize(size: FontSize, direction: 'inc' | 'dec'): FontSize {
  const idx = FONT_SIZE_ORDER.indexOf(size);
  const nextIdx = direction === 'inc' ? idx + 1 : idx - 1;
  return FONT_SIZE_ORDER[Math.min(FONT_SIZE_ORDER.length - 1, Math.max(0, nextIdx))];
}

export function getFontSize(): FontSize {
  try {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored && (FONT_SIZE_ORDER as string[]).includes(stored)) return stored as FontSize;
  } catch {
    // private browsing / storage disabled
  }
  return 'md';
}

export function setFontSize(size: FontSize): void {
  try {
    localStorage.setItem(FONT_SIZE_KEY, size);
  } catch {
    // ignore — preference just won't survive reload
  }
}

export function getHideRelated(): boolean {
  try {
    return localStorage.getItem(HIDE_RELATED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setHideRelated(hide: boolean): void {
  try {
    localStorage.setItem(HIDE_RELATED_KEY, hide ? '1' : '0');
  } catch {
    // ignore — preference just won't survive reload
  }
}
