import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBooks, fetchContinueReading } from '../api';
import type { Book } from '../types';
import { isAuthenticated } from '../auth';
import { isMemberAuthenticated } from '../memberAuth';
import NavBrand from '../components/NavBrand';
import ThemeToggle from '../components/ThemeToggle';
import NavUser from '../components/NavUser';
import { useSeo } from '../useSeo';

const FILE_TYPE_LABEL: Record<string, string> = { PDF: 'PDF', TXT: 'Text' };

function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SkeletonGrid() {
  return (
    <div className="skeleton-grid">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="skeleton-card">
          <div className="skeleton-block" style={{ height: 18, width: '40%' }} />
          <div className="skeleton-block" style={{ height: 24, width: '85%' }} />
          <div className="skeleton-block" style={{ height: 14, width: '100%', marginTop: 4 }} />
          <div className="skeleton-block" style={{ height: 14, width: '75%' }} />
        </div>
      ))}
    </div>
  );
}

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [continueBooks, setContinueBooks] = useState<Book[]>([]);
  const loggedIn = isAuthenticated() || isMemberAuthenticated();

  const categories = useMemo(() => {
    return Array.from(new Set(books.map((b) => b.category).filter((c): c is string => !!c))).sort();
  }, [books]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBooks({ q: query, category });
      setBooks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  useEffect(() => {
    if (!loggedIn) return;
    fetchContinueReading().then(setContinueBooks).catch(() => setContinueBooks([]));
  }, [loggedIn]);

  useSeo({
    title: 'Library',
    description: 'Books available to read online — PDF and text, some public, some by invitation.',
    path: '/library',
  });

  return (
    <>
      <nav className="site-nav">
        <div className="site-nav__inner">
          <NavBrand />
          <div className="site-nav__links">
            <Link to="/" className="site-nav__link">Home</Link>
            <Link to="/library" className="site-nav__link site-nav__link--active">Library</Link>
            {loggedIn && <Link to="/library/highlights" className="site-nav__link">My Highlights</Link>}
            <Link to="/about" className="site-nav__link">About</Link>
            <ThemeToggle />
            <NavUser />
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero__inner">
          <p className="hero__eyebrow">✦ Library</p>
          <h1 className="hero__title">Books</h1>
          <p className="hero__tagline">Read PDF and text books online — no download required.</p>
        </div>
      </section>

      <div className="container">
        {loggedIn && continueBooks.length > 0 && (
          <section className="post-section" style={{ marginBottom: 8 }}>
            <p className="section-label">Continue reading</p>
            <div className="post-grid">
              {continueBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </section>
        )}

        <div className="filters-bar">
          <div className="filters-bar__inner">
            <div className="filters-bar__search">
              <span className="filters-bar__search-icon">&#128269;</span>
              <input
                className="filters-bar__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search books..."
                aria-label="Search books"
              />
            </div>
            <select
              className="filters-bar__select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        <section className="post-section">
          {!loading && (query || category) && (
            <p className="section-label">
              {books.length} result{books.length !== 1 ? 's' : ''}
              {query ? ` for "${query}"` : ''}
              {category ? ` in ${category}` : ''}
            </p>
          )}
          {!loading && !query && !category && <p className="section-label">All books</p>}

          {loading && <SkeletonGrid />}

          {!loading && error && (
            <div className="error-banner">
              <span className="error-banner__text">{error}</span>
              <button className="error-banner__retry" onClick={load}>Retry</button>
            </div>
          )}

          {!loading && !error && books.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">&#128218;</div>
              <p className="empty-state__title">No books in the library yet.</p>
              <p className="empty-state__desc">
                {query || category ? 'Try a different search term or category.' : 'Check back soon.'}
              </p>
            </div>
          )}

          {!loading && !error && books.length > 0 && (
            <div className="post-grid">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="site-footer">
        <p className="site-footer__text">
          &copy; {new Date().getFullYear()} TECH2BLOGS &mdash;{' '}
          <Link to="/" className="site-footer__link">Home</Link> &mdash;{' '}
          <Link to="/about" className="site-footer__link">About</Link>
        </p>
        <p className="site-footer__credit">Made by Viet Tran Tuan</p>
      </footer>
    </>
  );
}

function BookCard({ book }: { book: Book }) {
  const target = book.locked ? '#' : `/library/${book.slug}`;
  return (
    <article className="post-card">
      {book.hasCoverImage && book.coverImageUrl ? (
        <img src={book.coverImageUrl} alt={book.title} className="post-card__cover" />
      ) : (
        <div className="post-card__cover book-card__cover-placeholder" aria-hidden>
          {book.fileType === 'PDF' ? '📕' : '📃'}
        </div>
      )}
      <div className="post-card__meta">
        {book.category && <span className="post-card__category">{book.category}</span>}
        <span className="post-card__date">{FILE_TYPE_LABEL[book.fileType]}{book.fileSize ? ` · ${formatSize(book.fileSize)}` : ''}</span>
        {book.locked && <span className="post-card__private-badge" title="Private book">🔒 Private</span>}
      </div>

      <h2 className="post-card__title">
        {book.locked ? (
          <span className="post-card__title-link">{book.title}</span>
        ) : (
          <Link to={target} className="post-card__title-link">{book.title}</Link>
        )}
      </h2>

      {book.author && <p className="book-card__author">by {book.author}</p>}
      {book.description && <p className="post-card__excerpt">{book.description}</p>}

      {book.readProgress && book.readProgress.percent > 0 && (
        <div className="book-card__progress">
          <div className="book-card__progress-bar">
            <div className="book-card__progress-fill" style={{ width: `${book.readProgress.percent}%` }} />
          </div>
          <span className="book-card__progress-label">{book.readProgress.percent}% read</span>
        </div>
      )}

      <div className="post-card__footer">
        {book.locked ? (
          <span className="post-card__read-more" style={{ color: 'var(--color-text-muted)' }}>Locked</span>
        ) : (
          <Link to={target} className="post-card__read-more">Read →</Link>
        )}
      </div>
    </article>
  );
}
