import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { fetchBookBySlug, fetchBookFileBlob, BookAccessDeniedError } from '../api';
import type { Book, AccessDenialCode } from '../types';
import { isAuthenticated } from '../auth';
import { isMemberAuthenticated } from '../memberAuth';
import ReaderToolbar from '../components/ReaderToolbar';
import PdfReader from '../components/PdfReader';
import TxtReader from '../components/TxtReader';
import BookHighlightsPanel from '../components/BookHighlightsPanel';
import { useReadingProgress } from '../hooks/useReadingProgress';
import { useBookHighlights } from '../hooks/useBookHighlights';

const DENIAL_TITLE: Record<AccessDenialCode, string> = {
  NOT_AUTHENTICATED: 'This book is private. Please sign in to continue.',
  ACCOUNT_PENDING: 'Your account is awaiting approval.',
  ACCOUNT_REJECTED: 'Your account registration was not approved.',
  ACCOUNT_SUSPENDED: 'Your account has been suspended.',
  NO_ACCESS: "You don't have permission to read this book.",
};

export default function BookReaderPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loggedIn = isAuthenticated() || isMemberAuthenticated();

  const [book, setBook] = useState<Book | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denial, setDenial] = useState<AccessDenialCode | null>(null);
  const [percent, setPercent] = useState(0);

  const [userChoice, setUserChoice] = useState<'resume' | 'restart' | null>(null);

  // Highlights (Phase 2). `?highlight={id}` deep-links straight to one on open;
  // panel clicks update the same state afterward (see jumpToHighlightId below).
  const deepLinkHighlightId = (() => {
    const raw = searchParams.get('highlight');
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  })();
  const [panelOpen, setPanelOpen] = useState(false);
  const [jumpToHighlightId, setJumpToHighlightId] = useState<number | null>(deepLinkHighlightId);
  const { highlights, create, updateNote, remove } = useBookHighlights(book?.id ?? 0, loggedIn);

  function requireSignIn() {
    navigate('/member/login');
  }

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setDenial(null);
      try {
        const meta = await fetchBookBySlug(slug!);
        if (cancelled) return;
        setBook(meta);
        if (meta.fileUrl) {
          const fileBlob = await fetchBookFileBlob(meta.fileUrl);
          if (cancelled) return;
          setBlob(fileBlob);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof BookAccessDeniedError) {
          setDenial(err.code);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load book');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  const unit = book?.fileType === 'PDF' ? 'PAGE' : 'PERCENT';
  const { initialProgress, report } = useReadingProgress(book?.id ?? 0, unit, loggedIn);

  // Derived, not stored: 'pending' while the progress fetch is still in flight OR
  // there's a saved position awaiting an explicit choice; 'restart' once we know
  // there's nothing to resume. Only an explicit button click sets userChoice.
  // A highlight deep-link always wins over the resume prompt — "take me to
  // this highlight" beats "continue from page 12?" — fed in as a third
  // source rather than an effect that sets state (this file hit
  // react-hooks/set-state-in-effect once already; derive-don't-sync is the
  // established idiom here, see docs/06-project-memory.md).
  const resumeChoice: 'pending' | 'resume' | 'restart' = deepLinkHighlightId != null
    ? 'restart'
    : userChoice
      ?? (initialProgress === undefined
        ? 'pending'
        : initialProgress && initialProgress.position > 0
          ? 'pending'
          : 'restart');

  function handlePdfProgress(page: number, totalPages: number) {
    const pct = totalPages > 0 ? Math.round((page / totalPages) * 100) : 0;
    setPercent(pct);
    report(page, totalPages);
  }

  function handleTxtProgress(pct: number) {
    setPercent(pct);
    report(pct, 100);
  }

  if (loading) {
    return (
      <div className="reader-page">
        <div className="spinner-wrap" style={{ padding: '120px 0' }}>
          <div className="spinner" />
          <span className="spinner-label">Opening book...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reader-page">
        <div className="empty-state" style={{ padding: '80px 24px' }}>
          <div className="empty-state__icon">&#128218;</div>
          <p className="empty-state__title">Couldn't open this book</p>
          <p className="empty-state__desc">{error}</p>
        </div>
      </div>
    );
  }

  if (denial) {
    return (
      <div className="reader-page">
        <div className="empty-state" style={{ padding: '80px 24px' }}>
          <div className="empty-state__icon">🔒</div>
          <p className="empty-state__title">{DENIAL_TITLE[denial]}</p>
        </div>
      </div>
    );
  }

  if (!book || !blob) {
    return null;
  }

  const showResumePrompt = resumeChoice === 'pending' && initialProgress && initialProgress.position > 0;
  const startPage = resumeChoice === 'resume' && initialProgress ? initialProgress.position : null;
  const startPercent = resumeChoice === 'resume' && initialProgress ? initialProgress.position : null;
  // While the resume prompt is up, don't render the reader body yet at a default
  // position — wait for the reader's choice so we don't flash page 1 first.
  const readyToRender = resumeChoice !== 'pending';

  const highlightProps = {
    highlights,
    loggedIn,
    onCreateHighlight: create,
    onUpdateHighlightNote: updateNote,
    onDeleteHighlight: remove,
    onRequireSignIn: requireSignIn,
    jumpToHighlightId,
  };

  return (
    <div className="reader-page">
      <ReaderToolbar
        title={book.title}
        backTo={`/library/${book.slug}`}
        percent={percent}
        downloadUrl={book.downloadable ? `/api/books/${book.id}/download` : null}
      >
        {loggedIn && (
          <>
            <button
              type="button"
              className={`reader-toolbar__btn${panelOpen ? ' reader-toolbar__btn--active' : ''}`}
              onClick={() => setPanelOpen((o) => !o)}
            >
              ✎ Highlights{highlights.length > 0 ? ` (${highlights.length})` : ''}
            </button>
            <Link to="/library/highlights" className="reader-toolbar__btn">My Highlights</Link>
          </>
        )}
      </ReaderToolbar>

      {readyToRender && book.fileType === 'PDF' && (
        <PdfReader blob={blob} startPage={startPage} onProgress={handlePdfProgress} {...highlightProps} />
      )}
      {readyToRender && book.fileType === 'TXT' && (
        <TxtReader blob={blob} startPercent={startPercent} onProgress={handleTxtProgress} {...highlightProps} />
      )}

      <BookHighlightsPanel
        open={panelOpen}
        highlights={highlights}
        onClose={() => setPanelOpen(false)}
        onJump={(h) => { setJumpToHighlightId(h.id); setPanelOpen(false); }}
        onUpdateNote={updateNote}
        onDelete={remove}
      />

      {showResumePrompt && initialProgress && (
        <div className="reader-resume-prompt">
          <span className="reader-resume-prompt__text">
            {book.fileType === 'PDF'
              ? `Continue from page ${initialProgress.position}?`
              : `Continue from where you left off (${initialProgress.position}%)?`}
          </span>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setUserChoice('resume')}>
            Continue
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setUserChoice('restart')}>
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
