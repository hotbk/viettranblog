import { useEffect, useRef, useState } from 'react';
// Type-only import — erased at compile time, so it does NOT pull pdfjs-dist
// into the eagerly-loaded main bundle. Only the runtime `import('react-pdf')`
// below is lazy; this is purely for search's `.getPage().getTextContent()` typing.
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface Props {
  blob: Blob;
  /** Page to jump to once loaded, from saved progress. Applied once. */
  startPage: number | null;
  onProgress: (page: number, totalPages: number) => void;
}

type ReactPdfModule = typeof import('react-pdf');

/**
 * Renders one PDF page at a time via pdf.js (react-pdf), lazy-loaded the same
 * way `mammoth` is for DOCX attachments — confirmed in the build output as its
 * own chunk, not part of the main bundle. Native `<iframe>` rendering (used by
 * the post-attachment viewer) can't report back the current page, which is
 * why this module renders the PDF itself instead — see
 * docs/08-book-library-module.md §4.2.
 */
export default function PdfReader({ blob, startPage, onProgress }: Props) {
  const [reactPdf, setReactPdf] = useState<ReactPdfModule | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [page, setPage] = useState(startPage && startPage > 0 ? startPage : 1);
  const [containerWidth, setContainerWidth] = useState(800);
  const appliedStart = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [matchPages, setMatchPages] = useState<number[]>([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchRunId = useRef(0);

  // Lazy-load the pdf.js renderer + wire its worker to a bundled asset (never a
  // CDN — see R3 in docs/08-book-library-module.md).
  useEffect(() => {
    let cancelled = false;
    import('react-pdf')
      .then((mod) => {
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goToPage(page + 1);
      if (e.key === 'ArrowLeft') goToPage(page - 1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, numPages]);

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
            if (!appliedStart.current && startPage) {
              setPage(Math.min(startPage, n));
              appliedStart.current = true;
            }
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
            pageNumber={page}
            width={containerWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="reader-body__pdf-page"
          />
        </Document>
      </div>

      {numPages != null && (
        <div className="reader-toolbar__controls" style={{ justifyContent: 'center', padding: '8px 0' }}>
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
        </div>
      )}
    </>
  );
}
