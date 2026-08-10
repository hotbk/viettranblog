import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBookProgress, putBookProgress } from '../api';
import type { ProgressUnit } from '../types';

interface SavedProgress {
  position: number;
  total: number;
}

const DEBOUNCE_MS = 2000;

/**
 * Server-side progress for logged-in readers; localStorage for anonymous ones
 * (see docs/08-book-library-module.md §1.3 — no anonymous-writable server
 * endpoint, on purpose). Debounces writes, and flushes immediately on
 * `visibilitychange`/unmount so closing the tab doesn't lose the last position.
 */
export function useReadingProgress(bookId: number, unit: ProgressUnit, loggedIn: boolean) {
  // undefined = still loading; null = no saved progress found
  const [initialProgress, setInitialProgress] = useState<SavedProgress | null | undefined>(undefined);
  const latestRef = useRef<SavedProgress | null>(null);
  const timerRef = useRef<number | null>(null);
  const localKey = `book-progress-${bookId}`;

  useEffect(() => {
    // bookId is 0 until the book's metadata has actually loaded (see
    // BookReaderPage's `book?.id ?? 0`) — skip the fetch rather than asking
    // the server for a nonexistent /api/books/0/progress every time.
    if (!bookId) return;
    let cancelled = false;
    async function load() {
      if (loggedIn) {
        try {
          const p = await fetchBookProgress(bookId);
          if (!cancelled) setInitialProgress(p ? { position: p.position, total: p.total } : null);
        } catch {
          if (!cancelled) setInitialProgress(null);
        }
      } else {
        const raw = window.localStorage.getItem(localKey);
        if (cancelled) return;
        if (raw) {
          try {
            setInitialProgress(JSON.parse(raw) as SavedProgress);
          } catch {
            setInitialProgress(null);
          }
        } else {
          setInitialProgress(null);
        }
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, loggedIn]);

  const flush = useCallback(() => {
    const p = latestRef.current;
    if (!p) return;
    if (loggedIn) {
      putBookProgress(bookId, { position: p.position, total: p.total, unit }).catch(() => { /* best-effort */ });
    } else {
      window.localStorage.setItem(localKey, JSON.stringify(p));
    }
  }, [bookId, unit, loggedIn, localKey]);

  const report = useCallback((position: number, total: number) => {
    latestRef.current = { position, total };
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') flush();
    }
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', flush);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      flush();
    };
  }, [flush]);

  return { initialProgress, report };
}
