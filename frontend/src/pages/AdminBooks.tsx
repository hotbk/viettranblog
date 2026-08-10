import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchAdminBooks, deleteBook, updateBookStatus, UnauthorizedError } from '../api';
import { logout } from '../auth';
import ThemeToggle from '../components/ThemeToggle';
import type { Book } from '../types';

export default function AdminBooks() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusUpdatingIds, setStatusUpdatingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchAdminBooks()
      .then((data) => { if (!cancelled) setBooks(data); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load books');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [navigate]);

  function handleLogout() { logout(); navigate('/admin/login'); }

  async function handleDelete(book: Book) {
    if (!window.confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
    setDeleteError(null);
    setBooks((prev) => prev.filter((b) => b.id !== book.id));
    try {
      await deleteBook(book.id);
    } catch (err) {
      setBooks((prev) => (prev.some((b) => b.id === book.id) ? prev : [book, ...prev]));
      if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete book');
    }
  }

  async function handleToggleStatus(book: Book) {
    if (statusUpdatingIds.has(book.id)) return;
    const next = book.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    setStatusUpdatingIds((prev) => new Set(prev).add(book.id));
    setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, status: next } : b)));
    try {
      const updated = await updateBookStatus(book.id, next);
      setBooks((prev) => prev.map((b) => (b.id === book.id ? updated : b)));
    } catch (err) {
      setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, status: book.status } : b)));
      if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setStatusUpdatingIds((prev) => { const next2 = new Set(prev); next2.delete(book.id); return next2; });
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <div className="admin-topbar__inner">
          <div className="admin-topbar__brand">
            <span className="admin-topbar__brand-name">TECH2BLOGS</span>
            <span className="admin-topbar__brand-sub">Admin Panel</span>
          </div>
          <div className="admin-topbar__actions">
            <ThemeToggle />
            <Link to="/admin/posts" className="admin-topbar__view-site">Posts</Link>
            <Link to="/admin/series" className="admin-topbar__view-site">Series</Link>
            <Link to="/admin/exams" className="admin-topbar__view-site">Exams</Link>
            <Link to="/admin/users" className="admin-topbar__view-site">Users</Link>
            <Link to="/admin/about" className="admin-topbar__view-site">About</Link>
            <Link to="/" className="admin-topbar__view-site">View site &rarr;</Link>
            <button className="btn--topbar-logout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="admin-posts-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Library</h1>
            <p className="admin-page-subtitle">{loading ? 'Loading...' : `${books.length} book${books.length !== 1 ? 's' : ''} total`}</p>
          </div>
          <Link to="/admin/books/new" className="btn btn--accent">+ New Book</Link>
        </div>

        {loading && (
          <div className="spinner-wrap"><div className="spinner" /><span className="spinner-label">Loading...</span></div>
        )}

        {!loading && error && (
          <div className="error-banner"><span className="error-banner__text">{error}</span></div>
        )}
        {deleteError && (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            <span className="error-banner__text">{deleteError}</span>
            <button className="error-banner__retry" onClick={() => setDeleteError(null)}>Dismiss</button>
          </div>
        )}

        {!loading && !error && books.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <p className="empty-state__title">No books yet</p>
            <p className="empty-state__desc">Upload your first PDF or text book.</p>
            <Link to="/admin/books/new" className="btn btn--accent" style={{ marginTop: 16 }}>+ New Book</Link>
          </div>
        )}

        {!loading && !error && books.length > 0 && (
          <div className="posts-table-wrap">
            <table className="posts-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Slug</th>
                  <th>Type</th>
                  <th>Visibility</th>
                  <th>Status</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr key={book.id}>
                    <td><div className="post-title-cell__title">{book.title}</div></td>
                    <td><div className="post-title-cell__slug">{book.slug}</div></td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{book.fileType}</td>
                    <td>
                      {book.visibility === 'PRIVATE' ? (
                        <span className="post-card__private-badge" title="Private book">
                          🔒 Private{typeof book.accessGroupCount === 'number' ? ` · ${book.accessGroupCount} group${book.accessGroupCount !== 1 ? 's' : ''}` : ''}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Public</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`badge ${book.status === 'PUBLISHED' ? 'badge--published' : 'badge--draft'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        disabled={statusUpdatingIds.has(book.id)}
                        onClick={() => handleToggleStatus(book)}
                      >
                        {statusUpdatingIds.has(book.id) ? '...' : book.status}
                      </button>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/admin/books/${book.id}/edit`} className="btn btn--ghost btn--sm">Edit</Link>
                        <button className="btn btn--danger-ghost btn--sm" onClick={() => handleDelete(book)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
