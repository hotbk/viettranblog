export const HOME_POST_LIST_SIZES = [10, 20, 30, 50] as const;
export type HomePostListSize = (typeof HOME_POST_LIST_SIZES)[number];

const STORAGE_KEY = 'tb-home-post-list-size';
const DEFAULT_SIZE: HomePostListSize = 20;

export function getHomePostListSize(): HomePostListSize {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return HOME_POST_LIST_SIZES.includes(stored as HomePostListSize)
      ? (stored as HomePostListSize)
      : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

export function setHomePostListSize(size: HomePostListSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(size));
  } catch {
    // The preference remains active for this page load when storage is unavailable.
  }
}
