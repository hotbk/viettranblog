import { useEffect, useState } from 'react';
import {
  fetchBookHighlights, createBookHighlight, updateBookHighlightNote, deleteBookHighlight,
  HighlightError, type CreateHighlightRequest,
} from '../api';
import type { BookHighlight } from '../types';

/**
 * Loads a book's highlights once on open and exposes optimistic
 * create/updateNote/remove — see docs/09-book-highlights-phase2.md §6.1.
 * No-op for anonymous readers: `enabled` gates the initial fetch, and the
 * mutators are simply never called for a signed-out reader (the popup shows
 * "Sign in to save highlights" instead — a UI-level decision, not a hook one).
 */
export function useBookHighlights(bookId: number, enabled: boolean) {
  const [highlights, setHighlights] = useState<BookHighlight[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !bookId) {
      // Deferred to a microtask (not called synchronously in the effect body)
      // so this satisfies react-hooks/set-state-in-effect the same way the
      // async load() branch below does — see PdfReader.tsx for the sibling
      // idiom used elsewhere in this codebase for the same rule.
      queueMicrotask(() => setLoaded(true));
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchBookHighlights(bookId);
        if (!cancelled) setHighlights(data);
      } catch {
        // Highlights failing to load never blocks reading — the book renders
        // either way (repo rule #6, "never block the text on the highlight fetch").
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [bookId, enabled]);

  async function create(request: CreateHighlightRequest): Promise<BookHighlight> {
    const tempId = -Date.now();
    const optimistic: BookHighlight = {
      id: tempId,
      bookId,
      anchorType: request.anchorType,
      startOffset: request.startOffset ?? null,
      endOffset: request.endOffset ?? null,
      pageNumber: request.pageNumber ?? null,
      rects: request.rects ?? null,
      color: request.color ?? 'YELLOW',
      text: request.text,
      note: request.note ?? null,
      stale: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setHighlights((prev) => [...prev, optimistic]);
    try {
      const saved = await createBookHighlight(bookId, request);
      setHighlights((prev) => prev.map((h) => (h.id === tempId ? saved : h)));
      return saved;
    } catch (err) {
      setHighlights((prev) => prev.filter((h) => h.id !== tempId));
      setError(err instanceof HighlightError ? err.message : 'Failed to save highlight');
      throw err;
    }
  }

  async function updateNote(id: number, note: string | null): Promise<void> {
    const previous = highlights;
    setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, note } : h)));
    try {
      const saved = await updateBookHighlightNote(bookId, id, note);
      setHighlights((prev) => prev.map((h) => (h.id === id ? saved : h)));
    } catch (err) {
      setHighlights(previous);
      setError(err instanceof HighlightError ? err.message : 'Failed to update note');
      throw err;
    }
  }

  async function remove(id: number): Promise<void> {
    const previous = highlights;
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    try {
      await deleteBookHighlight(bookId, id);
    } catch (err) {
      setHighlights(previous);
      setError(err instanceof HighlightError ? err.message : 'Failed to delete highlight');
      throw err;
    }
  }

  return { highlights, loaded, error, create, updateNote, remove, clearError: () => setError(null) };
}
