import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { fetchBookBySlug, BookAccessDeniedError } from '../api';
import type { Book, AccessDenialCode } from '../types';
import { LANGUAGE_BCP47 } from '../types';
import NavBrand from '../components/NavBrand';
import ThemeToggle from '../components/ThemeToggle';
import NavUser from '../components/NavUser';
import TranslationSwitcher from '../components/TranslationSwitcher';
import { useSeo } from '../useSeo';

const DENIAL_COPY: Record<AccessDenialCode, { title: string; desc: string }> = {
  NOT_AUTHENTICATED: {
    title: 'This book is private.',
    desc: 'Please sign in to continue.',
  },
  ACCOUNT_PENDING: {
    title: 'Your account is awaiting approval.',
    desc: 'An admin needs to approve your account before you can access private books.',
  },
  ACCOUNT_REJECTED: {
    title: 'Your account registration was not approved.',
    desc: 'Contact an admin if you believe this is a mistake.',
  },
  ACCOUNT_SUSPENDED: {
    title: 'Your account has been suspended.',
    desc: 'Contact an admin for more information.',
  },
  NO_ACCESS: {
    title: "You don't have permission to read this book.",
    desc: 'Contact an admin if you believe you should have access.',
  },
};

function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BookDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denial, setDenial] = useState<AccessDenialCode | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setDenial(null);
      try {
        const data = await fetchBookBySlug(slug!);
        if (!cancelled) setBook(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof BookAccessDeniedError) {
          setDenial(err.code);
        } else {
          setError(err instanceof Error ? err.message : 'Book not found');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  const publishedSiblings = book ? book.translations.filter((t) => t.status === 'PUBLISHED') : [];
  const alternates = book && publishedSiblings.length > 0
    ? [
        { hreflang: LANGUAGE_BCP47[book.language], path: `/library/${book.slug}` },
        ...publishedSiblings.map((t) => ({ hreflang: LANGUAGE_BCP47[t.language], path: `/library/${t.slug}` })),
      ]
    : undefined;

  useSeo(
    book
      ? {
          title: book.title,
          description: book.description || `Read "${book.title}" on TECH2BLOGS.`,
          path: `/library/${book.slug}`,
          lang: LANGUAGE_BCP47[book.language],
          alternates,
        }
      : { title: 'Library', description: 'TECH2BLOGS library.', noindex: true }
  );

  return (
    <>
      <nav className="site-nav">
        <div className="site-nav__inner">
          <NavBrand />
          <div className="site-nav__links">
            <Link to="/" className="site-nav__link">Home</Link>
            <Link to="/library" className="site-nav__link">Library</Link>
            <ThemeToggle />
            <NavUser />
          </div>
        </div>
      </nav>

      <div className="post-detail-page">
        <div className="post-detail__narrow">
          <button className="back-link" onClick={() => navigate(-1)}>Back to library</button>

          {loading && (
            <div className="spinner-wrap">
              <div className="spinner" />
              <span className="spinner-label">Loading book...</span>
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <div className="empty-state__icon">&#128218;</div>
              <p className="empty-state__title">Book not found</p>
              <p className="empty-state__desc">{error}</p>
              <Link to="/library" className="btn btn--primary" style={{ marginTop: 16 }}>Back to library</Link>
            </div>
          )}

          {!loading && denial && (
            <div className="empty-state private-denied">
              <div className="empty-state__icon" aria-hidden>🔒</div>
              <p className="empty-state__title">{DENIAL_COPY[denial].title}</p>
              <p className="empty-state__desc">{DENIAL_COPY[denial].desc}</p>
              <div className="private-denied__actions">
                {denial === 'NOT_AUTHENTICATED' ? (
                  <>
                    <Link to="/member/login" className="btn btn--primary">Sign in</Link>
                    <Link to="/library" className="btn btn--ghost">Back to library</Link>
                  </>
                ) : (
                  <Link to="/library" className="btn btn--ghost">Back to library</Link>
                )}
              </div>
            </div>
          )}

          {!loading && book && (
            <article>
              {book.hasCoverImage && book.coverImageUrl && (
                <img src={book.coverImageUrl} alt={book.title} className="post-detail__cover" />
              )}

              <div className="post-detail__category-row">
                {book.category && <span className="post-detail__category">{book.category}</span>}
                <span className="post-detail__date">{book.fileType === 'PDF' ? 'PDF' : 'Text'}</span>
                {book.fileSize != null && (
                  <span className="post-detail__date">{formatSize(book.fileSize)}</span>
                )}
              </div>

              <h1 className="post-detail__title">{book.title}</h1>

              <TranslationSwitcher
                translations={book.translations}
                publicPath={(slug) => `/library/${slug}`}
                adminEditPath={(id) => `/admin/books/${id}/edit`}
              />

              {book.author && <p className="book-detail__author">by {book.author}</p>}

              {book.readProgress && book.readProgress.percent > 0 && (
                <div className="book-card__progress" style={{ margin: '16px 0' }}>
                  <div className="book-card__progress-bar">
                    <div className="book-card__progress-fill" style={{ width: `${book.readProgress.percent}%` }} />
                  </div>
                  <span className="book-card__progress-label">{book.readProgress.percent}% read</span>
                </div>
              )}

              <div className="book-detail__actions">
                <Link to={`/library/${book.slug}/read`} className="btn btn--primary">
                  {book.readProgress && book.readProgress.percent > 0 ? 'Continue reading' : 'Start reading'}
                </Link>
                {book.downloadable && (
                  <a href={`/api/books/${book.id}/download`} className="btn btn--ghost" download>
                    Download
                  </a>
                )}
              </div>

              {book.description && (
                <>
                  <div className="post-detail__divider" />
                  <div className="post-detail__content">
                    <ReactMarkdown rehypePlugins={[rehypeRaw]}>{book.description}</ReactMarkdown>
                  </div>
                </>
              )}
            </article>
          )}
        </div>
      </div>

      <footer className="site-footer">
        <p className="site-footer__text">
          &copy; {new Date().getFullYear()} TECH2BLOGS &mdash;{' '}
          <Link to="/library" className="site-footer__link">Library</Link>
        </p>
        <p className="site-footer__credit">Made by Viet Tran Tuan</p>
      </footer>
    </>
  );
}
