import { useEffect, useRef, useState } from 'react';
// Type-only import — erased at compile time, so it does NOT pull pdfjs-dist
// into the eagerly-loaded main bundle. Only the runtime `import('react-pdf')`
// below is lazy; this is purely for search's `.getPage().getTextContent()` typing.
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { BookHighlight, HighlightColor, HighlightRect } from '../types';
import type { CreateHighlightRequest } from '../api';
import HighlightPopup from './HighlightPopup';
import HighlightNoteEditor from './HighlightNoteEditor';

interface Props {
  blob: Blob;
  /** Page to jump to once loaded, from saved progress. Applied once. */
  startPage: number | null;
  onProgress: (page: number, totalPages: number) => void;
  // --- Highlights (Phase 2, docs/09-book-highlights-phase2.md §6) ---
  highlights: BookHighlight[];
  loggedIn: boolean;
  onCreateHighlight: (request: CreateHighlightRequest) => Promise<BookHighlight>;
  onUpdateHighlightNote: (id: number, note: string | null) => Promise<void>;
  onDeleteHighlight: (id: number) => Promise<void>;
  onRequireSignIn: () => void;
  /** Deep-link (`?highlight={id}`) — jump straight to this highlight's page on open. */
  jumpToHighlightId?: number | null;
}

type ReactPdfModule = typeof import('react-pdf');

const HIGHLIGHT_TEXT_MAX = 2000;
const DEFAULT_COLOR: HighlightColor = 'YELLOW';

interface PendingSelection {
  pageNumber: number;
  rects: HighlightRect[];
  text: string;
  rect: DOMRect;
}

interface EditingHighlight {
  highlight: BookHighlight;
  rect: DOMRect;
}

/**
 * Renders one PDF page at a time via pdf.js (react-pdf), lazy-loaded the same
 * way `mammoth` is for DOCX attachments — confirmed in the build output as its
 * own chunk, not part of the main bundle. Native `<iframe>` rendering (used by
 * the post-attachment viewer) can't report back the current page, which is
 * why this module renders the PDF itself instead — see
 * docs/08-book-library-module.md §4.2.
 *
 * Phase 2 (highlights, docs/09-book-highlights-phase2.md §6.3) turns on
 * pdf.js's text layer for the single currently-rendered page only (never
 * globally — that was the memory tradeoff Phase 1 explicitly declined). The
 * highlight overlay rendered on top of it is deliberately `pointer-events:
 * none` end-to-end: clicking an existing highlight is resolved by manual
 * hit-testing in `handlePageMouseUp` against normalized rect coordinates,
 * not by DOM click delegation. pdf.js's `.textLayer` container covers the
 * whole page (`inset: 0`) at `z-index: 2` regardless of where its individual
 * (mostly-empty-space) text spans actually sit, so a click-through overlay
 * competing with it on z-index would be fighting a moving, unverifiable
 * target without a live browser to check it in. Manual hit-testing sidesteps
 * that entirely and was verified by reading pdf.js's shipped `TextLayer.css`
 * in `node_modules`, not by rendering it.
 */
export default function PdfReader({
  blob, startPage, onProgress,
  highlights, loggedIn, onCreateHighlight, onUpdateHighlightNote, onDeleteHighlight, onRequireSignIn,
  jumpToHighlightId,
}: Props) {
  const [reactPdf, setReactPdf] = useState<ReactPdfModule | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [page, setPage] = useState(startPage && startPage > 0 ? startPage : 1);
  const [containerWidth, setContainerWidth] = useState(800);
  const appliedStart = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRootRef = useRef<HTMLDivElement | null>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [matchPages, setMatchPages] = useState<number[]>([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchRunId = useRef(0);

  const [hasSelectableText, setHasSelectableText] = useState<boolean | null>(null);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [pendingMode, setPendingMode] = useState<'popup' | 'note' | null>(null);
  const [pendingColor, setPendingColor] = useState<HighlightColor>(DEFAULT_COLOR);
  const [editing, setEditing] = useState<EditingHighlight | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lazy-load the pdf.js renderer + the text-layer stylesheet together, wire
  // the worker to a bundled asset (never a CDN — see R3 in
  // docs/08-book-library-module.md). The CSS import stays inside this lazy
  // step, not a top-level import — PdfReader.tsx itself is eagerly imported
  // by BookReaderPage, so a static CSS import would land the stylesheet in
  // the main CSS bundle for every visitor, book reader or not.
  useEffect(() => {
    let cancelled = false;
    Promise.all([import('react-pdf'), import('react-pdf/dist/Page/TextLayer.css')])
      .then(([mod]) => {
        if (cancelled) return;
        mod.pdfjs.GlobalWorkerOptions.workerSrc =
          new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        setReactPdf(mod);
      })
      .catch(() => { if (!cancelled) setLoadError('Failed to load the PDF renderer'); });
    return () => { cancelled = true; };
  }, []);

  // NOT a useMemo — React 18 StrictMode double-invokes effects in dev, and a
  // memoized URL paired with a separate cleanup-only effect revokes the one
  // cached URL after the first pass, so the second pass hands pdf.js an
  // already-revoked blob (`ERR_FILE_NOT_FOUND`, found via live testing).
  // Creating + revoking inside the *same* effect keeps each pass's URL paired
  // with its own cleanup.
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  useEffect(() => {
    let url: string;
    function createAndSet() {
      url = URL.createObjectURL(blob);
      setFileUrl(url);
    }
    createAndSet();
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setContainerWidth(Math.min(900, containerRef.current.clientWidth - 32));
      }
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (numPages != null) {
      onProgress(page, numPages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, numPages]);

  // Per-page "can this be highlighted at all" check — a scanned/image PDF's
  // getTextContent() returns no items. Runs once per page; cheap (a single
  // page's text content, already-parsed by pdf.js), separate from the
  // multi-page search loop below.
  useEffect(() => {
    let cancelled = false;
    const doc = pdfDocRef.current;
    if (!doc || numPages == null) return;
    setHasSelectableText(null);
    doc.getPage(page)
      .then((p) => p.getTextContent())
      .then((content) => { if (!cancelled) setHasSelectableText(content.items.length > 0); })
      .catch(() => { if (!cancelled) setHasSelectableText(null); });
    return () => { cancelled = true; };
  }, [page, numPages]);

  // Jump to a highlight's page — fires on initial deep-link (`?highlight=`)
  // AND on every later "jump" click from BookHighlightsPanel, since
  // jumpToHighlightId can change repeatedly during one reading session (not
  // just once on mount). Guarded on the *id itself* changing, not a one-shot
  // ref, so clicking a different highlight always re-jumps.
  const lastJumpedId = useRef<number | null>(null);
  useEffect(() => {
    if (jumpToHighlightId == null || lastJumpedId.current === jumpToHighlightId || !numPages) return;
    const target = highlights.find((h) => h.id === jumpToHighlightId)?.pageNumber;
    lastJumpedId.current = jumpToHighlightId;
    // Deferred to a microtask, not called synchronously in the effect body —
    // same react-hooks/set-state-in-effect idiom used elsewhere in this
    // codebase (see useBookHighlights.ts).
    if (target) queueMicrotask(() => setPage(Math.min(Math.max(1, target), numPages)));
  }, [jumpToHighlightId, highlights, numPages]);

  function goToPage(next: number) {
    if (!numPages) return;
    setPage(Math.min(Math.max(1, next), numPages));
  }

  function handlePageInputSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(pageInputRef.current?.value ?? '', 10);
    if (!Number.isNaN(n)) goToPage(n);
  }

  /**
   * Finds which pages contain `query` via pdf.js text extraction
   * (`page.getTextContent()`), not the rendered text layer — that stays
   * disabled for memory (see the module docblock). Scope is deliberately
   * "jump between matching pages", not "highlight the match on the page":
   * without a text layer there's no DOM text to highlight, and re-enabling it
   * just to highlight search hits would reopen the memory tradeoff this
   * reader already made. See docs/08-book-library-module.md §4.4.
   */
  async function runSearch(query: string) {
    const trimmed = query.trim();
    const doc = pdfDocRef.current;
    if (!trimmed || !doc || !numPages) {
      setMatchPages([]);
      return;
    }
    const runId = ++searchRunId.current;
    setSearching(true);
    setHasSearched(true);
    const found: number[] = [];
    const lowerQuery = trimmed.toLowerCase();
    for (let i = 1; i <= numPages; i++) {
      if (searchRunId.current !== runId) return; // a newer search superseded this one
      try {
        const pdfPage = await doc.getPage(i);
        const content = await pdfPage.getTextContent();
        const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ').toLowerCase();
        if (text.includes(lowerQuery)) found.push(i);
      } catch {
        // Unreadable page — skip it rather than aborting the whole search.
      }
    }
    if (searchRunId.current !== runId) return;
    setMatchPages(found);
    setCurrentMatchIdx(0);
    setSearching(false);
    if (found.length > 0) goToPage(found[0]);
  }

  function nextMatchPage() {
    if (matchPages.length === 0) return;
    const next = (currentMatchIdx + 1) % matchPages.length;
    setCurrentMatchIdx(next);
    goToPage(matchPages[next]);
  }

  function prevMatchPage() {
    if (matchPages.length === 0) return;
    const prev = (currentMatchIdx - 1 + matchPages.length) % matchPages.length;
    setCurrentMatchIdx(prev);
    goToPage(matchPages[prev]);
  }

  function closeSearch() {
    searchRunId.current++; // cancel any in-flight search loop
    setSearchOpen(false);
    setSearchQuery('');
    setMatchPages([]);
    setSearching(false);
    setHasSearched(false);
  }

  function dismissPending() {
    setPendingSelection(null);
    setPendingMode(null);
    setPendingColor(DEFAULT_COLOR);
  }

  /** Selection -> new highlight, or a plain click on an existing one -> edit.
   * See the module docblock for why this is manual hit-testing rather than
   * DOM click handlers on the overlay rects. */
  function handlePageMouseUp(e: React.MouseEvent) {
    const pageEl = pageRootRef.current;
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();
    if (pageRect.width === 0 || pageRect.height === 0) return;

    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed && pageEl.contains(range.commonAncestorContainer)) {
        const rects: HighlightRect[] = Array.from(range.getClientRects())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => ({
            x: (r.left - pageRect.left) / pageRect.width,
            y: (r.top - pageRect.top) / pageRect.height,
            w: r.width / pageRect.width,
            h: r.height / pageRect.height,
          }));
        const text = range.toString().replace(/\s+/g, ' ').trim().slice(0, HIGHLIGHT_TEXT_MAX);
        if (rects.length > 0 && text.length > 0) {
          setPendingSelection({ pageNumber: page, rects, text, rect: range.getBoundingClientRect() });
          setPendingMode('popup');
          setPendingColor(DEFAULT_COLOR);
          setSaveError(null);
          return;
        }
      }
    }

    // Not a drag-selection — check whether this plain click landed on an
    // existing highlight's rect (normalized-coordinate hit-test).
    if (!sel || sel.isCollapsed) {
      const clickX = (e.clientX - pageRect.left) / pageRect.width;
      const clickY = (e.clientY - pageRect.top) / pageRect.height;
      const hit = pageHighlights.find((h) =>
        (h.rects ?? []).some((r) => clickX >= r.x && clickX <= r.x + r.w && clickY >= r.y && clickY <= r.y + r.h)
      );
      if (hit) {
        setEditing({ highlight: hit, rect: new DOMRect(e.clientX - 1, e.clientY - 1, 2, 2) });
      }
    }
  }

  async function saveNewHighlight(color: HighlightColor, note: string | null) {
    if (!pendingSelection) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onCreateHighlight({
        anchorType: 'PDF_RECTS',
        pageNumber: pendingSelection.pageNumber,
        rects: pendingSelection.rects,
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goToPage(page + 1);
      if (e.key === 'ArrowLeft') goToPage(page - 1);
      if (e.key === 'Escape' && pendingMode === 'popup') dismissPending();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, numPages, pendingMode]);

  if (loadError) {
    return (
      <div className="empty-state">
        <p className="empty-state__title">Couldn't load the PDF viewer</p>
        <p className="empty-state__desc">{loadError}</p>
      </div>
    );
  }

  if (!reactPdf || !fileUrl) {
    return (
      <div className="spinner-wrap" style={{ padding: '80px 0' }}>
        <div className="spinner" />
        <span className="spinner-label">Loading PDF renderer...</span>
      </div>
    );
  }

  const { Document, Page } = reactPdf;
  const pageHighlights = highlights.filter(
    (h) => h.anchorType === 'PDF_RECTS' && !h.stale && h.pageNumber === page
  );

  return (
    <>
      {searchOpen && (
        <div className="reader-search-bar">
          <form
            style={{ display: 'contents' }}
            onSubmit={(e) => { e.preventDefault(); runSearch(searchQuery); }}
          >
            <input
              type="text"
              className="reader-search-input"
              placeholder="Search in this book..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setHasSearched(false); setMatchPages([]); }}
              onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
              autoFocus
            />
          </form>
          <span className="reader-search-count">
            {searching
              ? 'Searching...'
              : matchPages.length > 0
                ? `Page ${matchPages[currentMatchIdx]} — ${currentMatchIdx + 1} of ${matchPages.length} pages`
                : hasSearched ? 'No pages found' : ''}
          </span>
          <button type="button" className="reader-toolbar__btn" onClick={prevMatchPage} disabled={matchPages.length === 0} aria-label="Previous matching page">↑</button>
          <button type="button" className="reader-toolbar__btn" onClick={nextMatchPage} disabled={matchPages.length === 0} aria-label="Next matching page">↓</button>
          <button type="button" className="reader-toolbar__btn" onClick={closeSearch} aria-label="Close search">✕</button>
        </div>
      )}

      <div className="reader-body" ref={containerRef}>
        <Document
          file={fileUrl}
          onLoadSuccess={(pdf) => {
            pdfDocRef.current = pdf;
            const n = pdf.numPages;
            setNumPages(n);
            // Only apply saved-progress startPage here; a highlight deep-link is
            // handled uniformly (initial open AND later panel clicks) by the
            // dedicated jump effect below.
            if (!appliedStart.current && jumpToHighlightId == null && startPage) {
              setPage(Math.min(startPage, n));
            }
            appliedStart.current = true;
          }}
          onLoadError={() => setLoadError('This file could not be read as a PDF.')}
          loading={
            <div className="spinner-wrap" style={{ padding: '80px 0' }}>
              <div className="spinner" />
              <span className="spinner-label">Loading book...</span>
            </div>
          }
        >
          <Page
            inputRef={(el) => { pageRootRef.current = el; }}
            pageNumber={page}
            width={containerWidth}
            renderTextLayer
            renderAnnotationLayer={false}
            className="reader-body__pdf-page"
            onMouseUp={handlePageMouseUp}
          >
            <div className="pdf-highlight-layer" aria-hidden>
              {pageHighlights.map((h) =>
                (h.rects ?? []).map((r, i) => (
                  <div
                    key={`${h.id}-${i}`}
                    className={`pdf-highlight-rect pdf-highlight-rect--${h.color.toLowerCase()}`}
                    style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                  />
                ))
              )}
            </div>
          </Page>
        </Document>

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
      </div>

      {numPages != null && (
        <div className="reader-toolbar__controls" style={{ justifyContent: 'center', padding: '8px 0', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`reader-toolbar__btn${searchOpen ? ' reader-toolbar__btn--active' : ''}`}
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
          >
            🔍 Search
          </button>
          <button type="button" className="reader-toolbar__btn" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
            ← Prev
          </button>
          <form onSubmit={handlePageInputSubmit} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              key={page}
              ref={pageInputRef}
              className="reader-toolbar__page-input"
              defaultValue={page}
              aria-label="Page number"
            />
            <span className="reader-toolbar__page-label">of {numPages}</span>
          </form>
          <button type="button" className="reader-toolbar__btn" onClick={() => goToPage(page + 1)} disabled={page >= numPages}>
            Next →
          </button>
          {hasSelectableText === false && (
            <span className="reader-toolbar__hint">
              This page has no selectable text (scanned image), so it can't be highlighted.
            </span>
          )}
        </div>
      )}
    </>
  );
}
