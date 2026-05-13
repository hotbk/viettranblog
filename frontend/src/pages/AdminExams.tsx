import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchAdminExams, deleteExam, UnauthorizedError } from '../api';
import { logout } from '../auth';
import type { ExamSummary } from '../types';

interface Toast { id: number; message: string; type: 'success' | 'error'; }
let toastId = 0;

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d);
}

export default function AdminExams() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(message: string, type: 'success' | 'error') {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await fetchAdminExams();
        if (!cancelled) setExams(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
        setFetchError(err instanceof Error ? err.message : 'Failed to load exams');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [navigate]);

  async function handleDelete(exam: ExamSummary) {
    if (!window.confirm(`Delete exam "${exam.title}"? This cannot be undone.`)) return;
    setExams((prev) => prev.filter((e) => e.id !== exam.id));
    try {
      await deleteExam(exam.id);
      showToast(`"${exam.title}" deleted.`, 'success');
    } catch (err) {
      setExams((prev) => (prev.some((e) => e.id === exam.id) ? prev : [exam, ...prev]));
      if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  }

  function handleLogout() { logout(); navigate('/admin/login'); }

  return (
    <>
      <header className="admin-topbar">
        <div className="admin-topbar__inner">
          <div className="admin-topbar__brand">
            <span className="admin-topbar__brand-name">viettran Blog</span>
            <span className="admin-topbar__brand-sub">Admin Panel</span>
          </div>
          <div className="admin-topbar__actions">
            <Link to="/admin/posts" className="admin-topbar__view-site">Posts</Link>
            <Link to="/admin/series" className="admin-topbar__view-site">Series</Link>
            <Link to="/admin/users" className="admin-topbar__view-site">Users</Link>
            <Link to="/admin/attempts" className="admin-topbar__view-site">Attempts</Link>
            <Link to="/" className="admin-topbar__view-site">View site &rarr;</Link>
            <button className="btn--topbar-logout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="admin-posts-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Exams</h1>
            <p className="admin-page-subtitle">
              {loading ? 'Loading...' : `${exams.length} exam${exams.length !== 1 ? 's' : ''} total`}
            </p>
          </div>
          <Link to="/admin/exams/new" className="btn btn--accent">+ New Exam</Link>
        </div>

        {loading && (
          <div className="spinner-wrap">
            <div className="spinner" />
            <span className="spinner-label">Loading exams...</span>
          </div>
        )}

        {!loading && fetchError && (
          <div className="error-banner">
            <span className="error-banner__text">{fetchError}</span>
            <button className="error-banner__retry" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {!loading && !fetchError && exams.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">&#128221;</div>
            <p className="empty-state__title">No exams yet</p>
            <p className="empty-state__desc">Create your first exam to get started.</p>
            <Link to="/admin/exams/new" className="btn btn--accent" style={{ marginTop: 16 }}>+ New Exam</Link>
          </div>
        )}

        {!loading && !fetchError && exams.length > 0 && (
          <div className="posts-table-wrap">
            <table className="posts-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Questions</th>
                  <th>Time Limit</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.id}>
                    <td>
                      <div className="post-title-cell__title">{exam.title}</div>
                      {exam.description && (
                        <div className="post-title-cell__slug" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exam.description}
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{exam.questionCount}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                      {exam.timeLimit ? `${exam.timeLimit} min` : '—'}
                    </td>
                    <td>
                      <span className={`badge ${exam.status === 'PUBLISHED' ? 'badge--published' : 'badge--draft'}`}>
                        {exam.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{formatDate(exam.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        <Link to={`/admin/exams/${exam.id}/edit`} className="btn btn--ghost btn--sm">Edit</Link>
                        <button className="btn btn--danger-ghost btn--sm" onClick={() => handleDelete(exam)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>{toast.message}</div>
      ))}
    </>
  );
}
