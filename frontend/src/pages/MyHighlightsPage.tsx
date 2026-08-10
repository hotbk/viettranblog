import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyHighlights, updateBookHighlightNote, deleteBookHighlight, HighlightError } from '../api';
import type { MyBookHighlight } from '../types';
import { isAuthenticated } from '../auth';
import { isMemberAuthenticated } from '../memberAuth';
import NavBrand from '../components/NavBrand';
import ThemeToggle from '../components/ThemeToggle';
import NavUser from '../components/NavUser';
import HighlightNoteEditor from '../components/HighlightNoteEditor';
import { useSeo } from '../useSeo';

/** Personal, logged-in-only view — cross-book list of the reader's own
 * highlights, grouped by book. Linked from ReaderToolbar and LibraryPage
 * only, not a top-level nav destination (docs/09-book-highlights-phase2.md
 * §6.1). */
export default function MyHighlightsPage() {
  const loggedIn = isAuthenticated() || isMemberAuthenticated();
  const [rows, setRows] = useState<MyBookHighlight[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useSeo({
    title: 'My Highlights',
    description: 'Your saved highlights and notes across every book in the library.',
    path: '/library/highlights',
  });

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    fetchMyHighlights(200)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load highlights'); });
    return () => { cancelled = true; };
  }, [loggedIn]);

  async function saveNote(row: MyBookHighlight, note: string) {
    setSavingId(row.highlight.id);
    setActionError(null);
    try {
      const updated = await updateBookHighlightNote(row.highlight.bookId, row.highlight.id, note.trim() || null);
      setRows((prev) => prev?.map((r) => (r.highlight.id === row.highlight.id ? { ...r, highlight: updated } : r)) ?? prev);
      setEditingId(null);
    } catch (err) {
      setActionError(err instanceof HighlightError ? err.message : 'Failed to update note');
    } finally {
      setSavingId(null);
    }
  }

  async function deleteHighlight(row: MyBookHighlight) {
    setSavingId(row.highlight.id);
    setActionError(null);
    try {
      await deleteBookHighlight(row.highlight.bookId, row.highlight.id);
      setRows((prev) => prev?.filter((r) => r.highlight.id !== row.highlight.id) ?? prev);
    } catch (err) {
      setActionError(err instanceof HighlightError ? err.message : 'Failed to delete highlight');
    } finally {
      setSavingId(null);
    }
  }

  const groups: { bookSlug: string; bookTitle: string; items: MyBookHighlight[] }[] = [];
  for (const row of rows ?? []) {
    let group = groups.find((g) => g.bookSlug === row.bookSlug);
    if (!group) {
      group = { bookSlug: row.bookSlug, bookTitle: row.bookTitle, items: [] };
      groups.push(group);
    }
    group.items.push(row);
  }

  return (
    <>
      <nav className="site-nav">
        <div className="site-nav__inner">
          <NavBrand />
          <div className="site-nav__links">
            <Link to="/" className="site-nav__link">Home</Link>
            <Link to="/library" className="site-nav__link">Library</Link>
            <Link to="/about" className="site-nav__link">About</Link>
            <ThemeToggle />
            <NavUser />
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero__inner">
          <p className="hero__eyebrow">✦ Library</p>
          <h1 className="hero__title">My Highlights</h1>
          <p className="hero__tagline">Everything you've highlighted, across every book.</p>
        </div>
      </section>

      <div className="container">
        {!loggedIn && (
          <div className="empty-state" style={{ padding: '80px 24px' }}>
            <div className="empty-state__icon">🔒</div>
            <p className="empty-state__title">Sign in to see your highlights.</p>
            <Link to="/member/login" className="btn btn--primary" style={{ marginTop: 12 }}>Sign in</Link>
          </div>
        )}

        {loggedIn && error && (
          <div className="error-banner">
            <span className="error-banner__text">{error}</span>
            <button className="error-banner__retry" onClick={() => { setError(null); setRows(null); }}>Retry</button>
          </div>
        )}

        {loggedIn && !error && rows === null && (
          <div className="spinner-wrap" style={{ padding: '80px 0' }}>
            <div className="spinner" />
            <span className="spinner-label">Loading your highlights...</span>
          </div>
        )}

        {loggedIn && !error && rows !== null && rows.length === 0 && (
          <div className="empty-state" style={{ padding: '80px 24px' }}>
            <div className="empty-state__icon">✎</div>
            <p className="empty-state__title">No highlights yet.</p>
            <p className="empty-state__desc">Open a book and select text to save your first one.</p>
            <Link to="/library" className="btn btn--primary" style={{ marginTop: 12 }}>Browse the library</Link>
          </div>
        )}

        {loggedIn && !error && rows !== null && rows.length > 0 && (
          <>
            {actionError && (
              <div className="error-banner" style={{ marginBottom: 16 }}>
                <span className="error-banner__text">{actionError}</span>
                <button className="error-banner__retry" onClick={() => setActionError(null)}>Dismiss</button>
              </div>
            )}
            {groups.map((group) => (
              <section key={group.bookSlug} className="post-section" style={{ marginBottom: 24 }}>
                <p className="section-label">{group.bookTitle}</p>
                <ul className="highlights-panel__list highlights-panel__list--page">
                  {group.items.map((row) => {
                    const h = row.highlight;
                    return (
                      <li key={h.id} className="highlights-panel__item">
                        <span className={`highlights-panel__swatch highlight-popup__swatch--${h.color.toLowerCase()}`} aria-hidden />
                        <div className="highlights-panel__body">
                          <Link to={`/library/${group.bookSlug}/read?highlight=${h.id}`} className="highlights-panel__snippet">
                            {h.text}
                          </Link>
                          {h.stale && (
                            <span className="highlights-panel__stale">
                              File changed since this was saved — position may be off
                            </span>
                          )}

                          {editingId === h.id ? (
                            <HighlightNoteEditor
                              mode="edit"
                              color={h.color}
                              initialNote={h.note ?? ''}
                              saving={savingId === h.id}
                              onSave={(note) => saveNote(row, note)}
                              onCancel={() => setEditingId(null)}
                            />
                          ) : h.note ? (
                            <button type="button" className="highlights-panel__note" onClick={() => setEditingId(h.id)}>
                              {h.note}
                            </button>
                          ) : (
                            <button type="button" className="highlights-panel__add-note" onClick={() => setEditingId(h.id)}>
                              + Add note
                            </button>
                          )}
                        </div>
                        <Link
                          to={`/library/${group.bookSlug}/read?highlight=${h.id}`}
                          className="highlights-panel__note"
                          style={{ alignSelf: 'center' }}
                        >
                          Open in book →
                        </Link>
                        <button
                          type="button"
                          className="highlights-panel__delete"
                          onClick={() => deleteHighlight(row)}
                          disabled={savingId === h.id}
                          aria-label="Delete highlight"
                        >
                          🗑
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>

      <footer className="site-footer">
        <p className="site-footer__text">
          &copy; {new Date().getFullYear()} TECH2BLOGS &mdash;{' '}
          <Link to="/" className="site-footer__link">Home</Link> &mdash;{' '}
          <Link to="/library" className="site-footer__link">Library</Link>
        </p>
        <p className="site-footer__credit">Made by Viet Tran Tuan</p>
      </footer>
    </>
  );
}
