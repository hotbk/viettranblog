import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchAdminTools, deleteTool, UnauthorizedError } from '../api';
import { logout } from '../auth';
import ThemeToggle from '../components/ThemeToggle';
import type { Tool } from '../types';

export default function AdminTools() {
  const navigate = useNavigate();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminTools()
      .then((data) => { if (!cancelled) setTools(data); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load tools');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [navigate]);

  function handleLogout() { logout(); navigate('/admin/login'); }

  async function handleDelete(tool: Tool) {
    if (!window.confirm(`Delete "${tool.title}"? This cannot be undone.`)) return;
    setDeleteError(null);
    setTools((prev) => prev.filter((t) => t.id !== tool.id));
    try {
      await deleteTool(tool.id);
    } catch (err) {
      setTools((prev) => (prev.some((t) => t.id === tool.id) ? prev : [tool, ...prev]));
      if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete tool');
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
            <Link to="/admin/books" className="admin-topbar__view-site">Books</Link>
            <Link to="/admin/tools" className="admin-topbar__view-site">Tools</Link>
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
            <h1 className="admin-page-title">Tools</h1>
            <p className="admin-page-subtitle">{loading ? 'Loading...' : `${tools.length} tool${tools.length !== 1 ? 's' : ''} total`}</p>
          </div>
          <Link to="/admin/tools/new" className="btn btn--accent">+ New Tool</Link>
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

        {!loading && !error && tools.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">🔧</div>
            <p className="empty-state__title">No tools yet</p>
            <p className="empty-state__desc">Paste a self-contained HTML/CSS/JS page to create your first tool.</p>
            <Link to="/admin/tools/new" className="btn btn--accent" style={{ marginTop: 16 }}>+ New Tool</Link>
          </div>
        )}

        {!loading && !error && tools.length > 0 && (
          <div className="posts-table-wrap">
            <table className="posts-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Slug</th>
                  <th>Category</th>
                  <th>Visibility</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((tool) => (
                  <tr key={tool.id}>
                    <td><div className="post-title-cell__title">{tool.title}</div></td>
                    <td><div className="post-title-cell__slug">{tool.slug}</div></td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{tool.category || '—'}</td>
                    <td>
                      {tool.visibility === 'PRIVATE' ? (
                        <span className="post-card__private-badge" title="Staff only">🔒 Private</span>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Public</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${tool.status === 'PUBLISHED' ? 'badge--published' : 'badge--draft'}`}>
                        {tool.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{tool.viewCount.toLocaleString()}</td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/admin/tools/${tool.id}/edit`} className="btn btn--ghost btn--sm">Edit</Link>
                        <button className="btn btn--danger-ghost btn--sm" onClick={() => handleDelete(tool)}>Delete</button>
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
