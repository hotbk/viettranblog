import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchAdminSeriesList, deleteSeries, UnauthorizedError } from '../api';
import { logout } from '../auth';
import AdminTopbar from '../components/AdminTopbar';
import type { SeriesSummary } from '../types';

export default function AdminSeries() {
  const navigate = useNavigate();
  const [list, setList] = useState<SeriesSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminSeriesList()
      .then((data) => { if (!cancelled) setList(data); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [navigate]);

  async function handleDelete(id: number, title: string) {
    if (!window.confirm(`Delete series "${title}"? Posts in this series will not be deleted.`)) return;
    setDeleteError(null);
    try {
      await deleteSeries(id);
      setList((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }


  return (
    <>
      <AdminTopbar active="series" />

      <div className="admin-posts-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Series</h1>
            <p className="admin-page-subtitle">
              {loading ? 'Loading...' : `${list.length} series total`}
            </p>
          </div>
          <Link to="/admin/series/new" className="btn btn--accent">+ New Series</Link>
        </div>

        {loading && (
          <div className="spinner-wrap">
            <div className="spinner" />
            <span className="spinner-label">Loading...</span>
          </div>
        )}

        {!loading && error && (
          <div className="error-banner">
            <span className="error-banner__text">{error}</span>
          </div>
        )}
        {deleteError && (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            <span className="error-banner__text">{deleteError}</span>
            <button className="error-banner__retry" onClick={() => setDeleteError(null)}>Dismiss</button>
          </div>
        )}

        {!loading && !error && list.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <p className="empty-state__title">No series yet</p>
            <p className="empty-state__desc">Create your first series to group posts by topic.</p>
            <Link to="/admin/series/new" className="btn btn--accent" style={{ marginTop: 16 }}>+ New Series</Link>
          </div>
        )}

        {!loading && !error && list.length > 0 && (
          <div className="posts-table-wrap">
            <table className="posts-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Slug</th>
                  <th>Posts</th>
                  <th>Status</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td><div className="post-title-cell__title">{s.title}</div></td>
                    <td><div className="post-title-cell__slug">{s.slug}</div></td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{s.postCount}</td>
                    <td>
                      <span className={`badge ${s.status === 'PUBLISHED' ? 'badge--published' : 'badge--draft'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/admin/series/${s.id}/edit`} className="btn btn--ghost btn--sm">Edit</Link>
                        <button className="btn btn--danger-ghost btn--sm" onClick={() => handleDelete(s.id, s.title)}>Delete</button>
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
