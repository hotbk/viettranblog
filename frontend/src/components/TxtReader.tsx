import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  blob: Blob;
  /** Scroll percent (0-100) to jump to once loaded, from saved progress. Applied once. */
  startPercent: number | null;
  onProgress: (percent: number) => void;
}

type Encoding = 'utf-8' | 'utf-16le' | 'utf-16be';

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

/** Splits `text` into plain-string segments plus <mark> nodes at each match offset. */
function renderHighlighted(
  text: string,
  matchLen: number,
  matches: number[],
  currentMatchIndex: number,
  currentMatchRef: React.RefObject<HTMLElement | null>,
): ReactNode {
  if (matches.length === 0) return text;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((start, i) => {
    if (start > cursor) nodes.push(text.slice(cursor, start));
    const isCurrent = i === currentMatchIndex;
    nodes.push(
      <mark
        key={start}
        ref={isCurrent ? currentMatchRef : undefined}
        className={isCurrent ? 'reader-search-mark reader-search-mark--current' : 'reader-search-mark'}
      >
        {text.slice(start, start + matchLen)}
      </mark>
    );
    cursor = start + matchLen;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

const FONT_STEPS = [15, 17, 19, 21];

export default function TxtReader({ blob, startPercent, onProgress }: Props) {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [encoding, setEncoding] = useState<Encoding>('utf-8');
  const [autoDetected, setAutoDetected] = useState<Encoding | null>(null);
  const [fontStep, setFontStep] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const appliedStart = useRef(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const currentMatchRef = useRef<HTMLElement>(null);

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

  useEffect(() => {
    if (!text || appliedStart.current || startPercent == null || !containerRef.current) return;
    const el = containerRef.current;
    const id = requestAnimationFrame(() => {
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = max > 0 ? (startPercent / 100) * max : 0;
    });
    appliedStart.current = true;
    return () => cancelAnimationFrame(id);
  }, [text, startPercent]);

  // Pure DOM side effect (scrollIntoView), not a setState call — safe in an effect.
  useEffect(() => {
    currentMatchRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentMatchIndex, searchQuery]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const percent = max <= 0 ? 100 : Math.round((el.scrollTop / max) * 100);
    onProgress(Math.min(100, Math.max(0, percent)));
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
        <div className="reader-body__txt" style={{ fontSize: FONT_STEPS[fontStep] }}>
          {renderHighlighted(text, searchQuery.trim().length, matches, currentMatchIndex, currentMatchRef)}
        </div>
      </div>

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
