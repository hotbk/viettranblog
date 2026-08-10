import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { BookHighlight, HighlightColor } from '../types';
import type { CreateHighlightRequest } from '../api';
import HighlightPopup from './HighlightPopup';
import HighlightNoteEditor from './HighlightNoteEditor';

interface Props {
  blob: Blob;
  /** Scroll percent (0-100) to jump to once loaded, from saved progress. Applied once. */
  startPercent: number | null;
  onProgress: (percent: number) => void;
  // --- Highlights (Phase 2, docs/09-book-highlights-phase2.md §6) ---
  highlights: BookHighlight[];
  loggedIn: boolean;
  onCreateHighlight: (request: CreateHighlightRequest) => Promise<BookHighlight>;
  onUpdateHighlightNote: (id: number, note: string | null) => Promise<void>;
  onDeleteHighlight: (id: number) => Promise<void>;
  onRequireSignIn: () => void;
  /** Deep-link (`?highlight={id}`) — scroll this highlight into view once, on open. */
  jumpToHighlightId?: number | null;
}

type Encoding = 'utf-8' | 'utf-16le' | 'utf-16be';

const HIGHLIGHT_TEXT_MAX = 2000;

/**
 * `blob.text()` assumes UTF-8, which mojibakes a Windows-1258/UTF-16 Vietnamese
 * .txt file — a real scenario for this library. BOM bytes are honoured first;
 * failing that, an explicit selector lets the reader pick a working decoding
 * instead of silently showing garbage (R10, docs/08-book-library-module.md).
 */
function decodeWithBom(buffer: ArrayBuffer): { text: string; detected: Encoding | null } {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(buffer.slice(3)), detected: 'utf-8' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(buffer.slice(2)), detected: 'utf-16le' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(buffer.slice(2)), detected: 'utf-16be' };
  }
  return { text: new TextDecoder('utf-8').decode(buffer), detected: null };
}

function looksGarbled(text: string): boolean {
  const sample = text.slice(0, 4000);
  if (sample.length === 0) return false;
  const replacementCount = (sample.match(/�/g) ?? []).length;
  return replacementCount / sample.length > 0.02; // >2% replacement chars
}

/** All (case-insensitive) start offsets of `query` in `text`. Empty query → no matches. */
function findMatches(text: string, query: string): number[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const indices: number[] = [];
  let pos = 0;
  let idx = lowerText.indexOf(lowerQuery, pos);
  while (idx !== -1) {
    indices.push(idx);
    pos = idx + lowerQuery.length;
    idx = lowerText.indexOf(lowerQuery, pos);
  }
  return indices;
}

interface HighlightSpan {
  id: number;
  start: number;
  end: number;
  color: HighlightColor;
}

/**
 * Boundary-sweep renderer — replaces the old single-pass search-only splitter.
 * Phase 2 needs two *overlapping* range sets (a saved highlight and a search
 * match can cover the same characters, and a segment can be both), so this
 * collects every boundary from both sets, sorts+dedupes them, and emits one
 * node per consecutive boundary pair with classes for whichever ranges cover
 * that segment. See docs/09-book-highlights-phase2.md §6.2.
 *
 * Every emitted segment carries `data-offset={segmentStart}` — the anchor
 * `resolveOffset()` below reads via `closest('[data-offset]')` to turn a live
 * selection back into absolute character offsets in O(1), independent of how
 * the text happens to be chunked into nodes.
 */
function renderHighlighted(
  text: string,
  matchLen: number,
  matches: number[],
  currentMatchIndex: number,
  currentMatchRef: React.RefObject<HTMLElement | null>,
  highlights: HighlightSpan[],
  jumpRef: React.RefObject<HTMLElement | null>,
  jumpToHighlightId: number | null | undefined,
  onHighlightClick: (id: number, el: HTMLElement) => void,
): ReactNode {
  if (matches.length === 0 && highlights.length === 0) {
    // No ranges to carve out — one wrapper span still needed so a *new*
    // selection (the common case: nothing highlighted yet) has a
    // `[data-offset]` ancestor to resolve against.
    return <span data-offset={0}>{text}</span>;
  }

  const boundaries = new Set<number>([0, text.length]);
  matches.forEach((start) => {
    boundaries.add(Math.max(0, Math.min(text.length, start)));
    boundaries.add(Math.max(0, Math.min(text.length, start + matchLen)));
  });
  highlights.forEach((h) => {
    boundaries.add(Math.max(0, Math.min(text.length, h.start)));
    boundaries.add(Math.max(0, Math.min(text.length, h.end)));
  });
  const sorted = Array.from(boundaries).sort((a, b) => a - b);

  const nodes: ReactNode[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const segStart = sorted[i];
    const segEnd = sorted[i + 1];
    if (segStart >= segEnd) continue;
    const segment = text.slice(segStart, segEnd);

    const matchIdx = matches.findIndex((m) => segStart >= m && segEnd <= m + matchLen);
    const isMatch = matchIdx !== -1;
    const isCurrentMatch = isMatch && matchIdx === currentMatchIndex;
    // First covering highlight wins if the reader's own highlights ever overlap
    // each other (rare, not prevented server-side) — the search/highlight
    // overlap this function exists for is handled fully; highlight-on-highlight
    // stacking beyond one layer is a deliberate simplification.
    const covering = highlights.find((h) => segStart >= h.start && segEnd <= h.end);
    const isJumpTarget = covering != null && covering.id === jumpToHighlightId;

    const classNames = ['reader-text-segment'];
    if (covering) classNames.push('reader-highlight', `reader-highlight--${covering.color.toLowerCase()}`);
    if (isMatch) classNames.push(isCurrentMatch ? 'reader-search-mark reader-search-mark--current' : 'reader-search-mark');

    const ref = isCurrentMatch ? currentMatchRef : isJumpTarget ? jumpRef : undefined;

    if (covering) {
      nodes.push(
        <mark
          key={segStart}
          data-offset={segStart}
          data-highlight-id={covering.id}
          ref={ref}
          className={classNames.join(' ')}
          onClick={(e) => onHighlightClick(covering.id, e.currentTarget)}
        >
          {segment}
        </mark>
      );
    } else if (isMatch) {
      nodes.push(
        <mark key={segStart} data-offset={segStart} ref={ref} className={classNames.join(' ')}>
          {segment}
        </mark>
      );
    } else {
      nodes.push(
        <span key={segStart} data-offset={segStart} className={classNames.join(' ')}>
          {segment}
        </span>
      );
    }
  }
  return nodes;
}

/** Absolute character offset for a Range endpoint, via the nearest `[data-offset]`
 * ancestor of its container (a text node's parentElement, or itself if already
 * an element) plus the in-node offset. Returns null if outside any rendered
 * segment (e.g. selection dragged onto surrounding chrome). */
function resolveOffset(node: Node, offsetWithinNode: number): number | null {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
  const withOffset = el?.closest('[data-offset]');
  if (!withOffset) return null;
  const base = Number(withOffset.getAttribute('data-offset'));
  if (Number.isNaN(base)) return null;
  return base + offsetWithinNode;
}

const FONT_STEPS = [15, 17, 19, 21];
const DEFAULT_COLOR: HighlightColor = 'YELLOW';

interface PendingSelection {
  startOffset: number;
  endOffset: number;
  text: string;
  rect: DOMRect;
}

interface EditingHighlight {
  highlight: BookHighlight;
  rect: DOMRect;
}

export default function TxtReader({
  blob, startPercent, onProgress,
  highlights, loggedIn, onCreateHighlight, onUpdateHighlightNote, onDeleteHighlight, onRequireSignIn,
  jumpToHighlightId,
}: Props) {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [encoding, setEncoding] = useState<Encoding>('utf-8');
  const [autoDetected, setAutoDetected] = useState<Encoding | null>(null);
  const [fontStep, setFontStep] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const appliedStart = useRef(false);
  const lastJumpedId = useRef<number | null>(null);
  const jumpRef = useRef<HTMLElement>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const currentMatchRef = useRef<HTMLElement>(null);

  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [pendingMode, setPendingMode] = useState<'popup' | 'note' | null>(null);
  const [pendingColor, setPendingColor] = useState<HighlightColor>(DEFAULT_COLOR);
  const [editing, setEditing] = useState<EditingHighlight | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    blob.arrayBuffer().then((buf) => {
      if (cancelled) return;
      setBuffer(buf);
      const { detected } = decodeWithBom(buf);
      if (detected) {
        setAutoDetected(detected);
        setEncoding(detected);
      }
    });
    return () => { cancelled = true; };
  }, [blob]);

  const text = buffer ? decodeManual(buffer, encoding, autoDetected) : null;
  const garbled = text != null && !autoDetected && looksGarbled(text);
  const matches = text ? findMatches(text, searchQuery) : [];

  const txtHighlightSpans: HighlightSpan[] = highlights
    .filter((h) => h.anchorType === 'TXT_OFFSET' && !h.stale && h.startOffset != null && h.endOffset != null)
    .map((h) => ({ id: h.id, start: h.startOffset as number, end: h.endOffset as number, color: h.color }));

  useEffect(() => {
    if (!text || appliedStart.current || startPercent == null || !containerRef.current) return;
    // Deep-link to a specific highlight takes priority over resume-by-percent;
    // BookReaderPage already skips the resume prompt in that case, but guard
    // here too in case this component is ever reused without that gate.
    if (jumpToHighlightId != null) { appliedStart.current = true; return; }
    const el = containerRef.current;
    const id = requestAnimationFrame(() => {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = max > 0 ? (startPercent / 100) * max : 0;
    });
    appliedStart.current = true;
    return () => cancelAnimationFrame(id);
  }, [text, startPercent, jumpToHighlightId]);

  // Pure DOM side effect (scrollIntoView), not a setState call — safe in an effect.
  useEffect(() => {
    currentMatchRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentMatchIndex, searchQuery]);

  // Jump to a highlight — fires on initial deep-link (`?highlight=`) AND on
  // every later "jump" click from BookHighlightsPanel (jumpToHighlightId can
  // change repeatedly in one session). Guarded on the id itself changing, not
  // a one-shot ref, so clicking a different highlight always re-scrolls.
  useEffect(() => {
    if (!text || jumpToHighlightId == null || lastJumpedId.current === jumpToHighlightId) return;
    if (jumpRef.current) {
      jumpRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      lastJumpedId.current = jumpToHighlightId;
    }
  }, [text, jumpToHighlightId, highlights]);

  // Dismiss the color-popup phase (not the note editor, which no longer needs
  // a live selection — its offsets were already captured) when the user's
  // selection collapses: clicking elsewhere, scrolling to reselect, Escape via
  // the browser's own selection handling, etc. See docs/09 §8 H11.
  useEffect(() => {
    function onSelectionChange() {
      if (pendingMode !== 'popup') return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setPendingSelection(null);
    }
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [pendingMode]);

  useEffect(() => {
    if (pendingMode !== 'popup') return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') dismissPending();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingMode]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const percent = max <= 0 ? 100 : Math.round((el.scrollTop / max) * 100);
    onProgress(Math.min(100, Math.max(0, percent)));
    if (pendingMode === 'popup') dismissPending();
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setCurrentMatchIndex(0);
  }

  function nextMatch() {
    if (matches.length === 0) return;
    setCurrentMatchIndex((i) => (i + 1) % matches.length);
  }

  function prevMatch() {
    if (matches.length === 0) return;
    setCurrentMatchIndex((i) => (i - 1 + matches.length) % matches.length);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
    setCurrentMatchIndex(0);
  }

  function dismissPending() {
    setPendingSelection(null);
    setPendingMode(null);
    setPendingColor(DEFAULT_COLOR);
  }

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed || !textRef.current?.contains(range.commonAncestorContainer)) return;

    const start = resolveOffset(range.startContainer, range.startOffset);
    const end = resolveOffset(range.endContainer, range.endOffset);
    if (start == null || end == null || end <= start || text == null) return;

    const clampedEnd = Math.min(end, start + HIGHLIGHT_TEXT_MAX);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return; // e.g. selection inside collapsed whitespace

    setPendingSelection({ startOffset: start, endOffset: clampedEnd, text: text.slice(start, clampedEnd), rect });
    setPendingMode('popup');
    setPendingColor(DEFAULT_COLOR);
    setSaveError(null);
  }

  async function saveNewHighlight(color: HighlightColor, note: string | null) {
    if (!pendingSelection) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onCreateHighlight({
        anchorType: 'TXT_OFFSET',
        startOffset: pendingSelection.startOffset,
        endOffset: pendingSelection.endOffset,
        text: pendingSelection.text,
        color,
        note,
      });
      window.getSelection()?.removeAllRanges();
      dismissPending();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save highlight');
    } finally {
      setSaving(false);
    }
  }

  function handleHighlightClick(id: number, el: HTMLElement) {
    const highlight = highlights.find((h) => h.id === id);
    if (!highlight) return;
    setEditing({ highlight, rect: el.getBoundingClientRect() });
  }

  async function saveEditedNote(note: string) {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onUpdateHighlightNote(editing.highlight.id, note.trim() || null);
      setEditing(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update note');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEditingHighlight() {
    if (!editing) return;
    setSaving(true);
    try {
      await onDeleteHighlight(editing.highlight.id);
      setEditing(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete highlight');
    } finally {
      setSaving(false);
    }
  }

  if (text === null) {
    return (
      <div className="spinner-wrap" style={{ padding: '80px 0' }}>
        <div className="spinner" />
        <span className="spinner-label">Loading book...</span>
      </div>
    );
  }

  return (
    <>
      {searchOpen && (
        <div className="reader-search-bar">
          <input
            type="text"
            className="reader-search-input"
            placeholder="Search in this book..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) prevMatch(); else nextMatch();
              }
              if (e.key === 'Escape') closeSearch();
            }}
            autoFocus
          />
          <span className="reader-search-count">
            {searchQuery.trim() ? (matches.length > 0 ? `${currentMatchIndex + 1} of ${matches.length}` : 'No results') : ''}
          </span>
          <button type="button" className="reader-toolbar__btn" onClick={prevMatch} disabled={matches.length === 0} aria-label="Previous match">↑</button>
          <button type="button" className="reader-toolbar__btn" onClick={nextMatch} disabled={matches.length === 0} aria-label="Next match">↓</button>
          <button type="button" className="reader-toolbar__btn" onClick={closeSearch} aria-label="Close search">✕</button>
        </div>
      )}

      <div className="reader-body" ref={containerRef} onScroll={handleScroll} style={{ overflowY: 'auto' }}>
        {garbled && (
          <div className="empty-state" style={{ marginBottom: 16 }}>
            <p className="empty-state__title">This text may not be displaying correctly.</p>
            <p className="empty-state__desc">
              Try a different encoding:{' '}
              <select
                className="reader-encoding-select"
                value={encoding}
                onChange={(e) => setEncoding(e.target.value as Encoding)}
              >
                <option value="utf-8">UTF-8</option>
                <option value="utf-16le">UTF-16 (LE)</option>
                <option value="utf-16be">UTF-16 (BE)</option>
              </select>
            </p>
          </div>
        )}
        <div
          ref={textRef}
          className="reader-body__txt"
          style={{ fontSize: FONT_STEPS[fontStep] }}
          onMouseUp={handleMouseUp}
        >
          {renderHighlighted(
            text, searchQuery.trim().length, matches, currentMatchIndex, currentMatchRef,
            txtHighlightSpans, jumpRef, jumpToHighlightId, handleHighlightClick,
          )}
        </div>
      </div>

      {pendingSelection && pendingMode === 'popup' && (
        <HighlightPopup
          rect={pendingSelection.rect}
          loggedIn={loggedIn}
          onPickColor={(color) => saveNewHighlight(color, null)}
          onAddNote={() => setPendingMode('note')}
          onSignIn={onRequireSignIn}
          onClose={dismissPending}
        />
      )}
      {pendingSelection && pendingMode === 'note' && (
        <HighlightNoteEditor
          rect={pendingSelection.rect}
          mode="create"
          color={pendingColor}
          onSelectColor={setPendingColor}
          saving={saving}
          onSave={(note) => saveNewHighlight(pendingColor, note.trim() || null)}
          onCancel={dismissPending}
        />
      )}
      {editing && (
        <HighlightNoteEditor
          rect={editing.rect}
          mode="edit"
          color={editing.highlight.color}
          initialNote={editing.highlight.note ?? ''}
          saving={saving}
          onSave={saveEditedNote}
          onCancel={() => setEditing(null)}
          onDelete={deleteEditingHighlight}
        />
      )}
      {saveError && (
        <div className="reader-highlight-toast" role="alert">
          {saveError}
          <button type="button" onClick={() => setSaveError(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      <div className="reader-toolbar__controls" style={{ justifyContent: 'center', padding: '8px 0' }}>
        <button
          type="button"
          className={`reader-toolbar__btn${searchOpen ? ' reader-toolbar__btn--active' : ''}`}
          onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
        >
          🔍 Search
        </button>
        <button
          type="button"
          className="reader-toolbar__btn"
          onClick={() => setFontStep((s) => Math.max(0, s - 1))}
          disabled={fontStep === 0}
          aria-label="Smaller text"
        >
          A-
        </button>
        <button
          type="button"
          className="reader-toolbar__btn"
          onClick={() => setFontStep((s) => Math.min(FONT_STEPS.length - 1, s + 1))}
          disabled={fontStep === FONT_STEPS.length - 1}
          aria-label="Larger text"
        >
          A+
        </button>
      </div>
    </>
  );
}

function decodeManual(buffer: ArrayBuffer, encoding: Encoding, autoDetected: Encoding | null): string {
  // If a BOM was found, honour it regardless of the manual selector (a BOM is authoritative).
  if (autoDetected) {
    return decodeWithBom(buffer).text;
  }
  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}
