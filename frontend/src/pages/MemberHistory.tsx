import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchMyAttempts, UnauthorizedError } from '../api';
import { memberLogout } from '../memberAuth';
import type { AttemptSummary } from '../types';
import NavBrand from '../components/NavBrand';

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function pct(a: AttemptSummary): number | null {
  if (a.score == null || !a.totalPoints) return null;
  return Math.round((a.score / a.totalPoints) * 100);
}

export default function MemberHistory() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyAttempts()
      .then((data) => { if (!cancelled) { setAttempts(data); setLoading(false); } })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) { memberLogout(); navigate('/member/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [navigate]);

  const submitted = attempts.filter((a) => a.status === 'SUBMITTED');
  const avgPct = submitted.length > 0 && submitted.every((a) => a.totalPoints)
    ? Math.round(submitted.reduce((acc, a) => acc + ((a.score ?? 0) / (a.totalPoints ?? 1)) * 100, 0) / submitted.length)
    : null;

  function handleLogout() { memberLogout(); navigate('/member/login'); }

  return (
    <>
      <nav className="site-nav">
        <div className="site-nav__inner">
          <NavBrand />
          <div className="site-nav__links">
            <Link to="/" className="site-nav__link">Home</Link>
            <Link to="/member/exams" className="site-nav__link">Exams</Link>
            <button className="btn btn--ghost btn--sm" onClick={handleLogout} style={{ marginLeft: 8 }}>Sign out</button>
          </div>
        </div>
      </nav>

      <div className="series-list-page">
        <div className="container">
          <h1 className="series-list__heading">My History</h1>
          <p className="series-list__desc">All your past exam attempts.</p>

          {!loading && !error && attempts.length > 0 && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              <div className="admin-stat-card">
                <span className="admin-stat-card__value">{attempts.length}</span>
                <span className="admin-stat-card__label">Total attempts</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-card__value">{submitted.length}</span>
                <span className="admin-stat-card__label">Completed</span>
              </div>
              {avgPct !== null && (
                <div className="admin-stat-card">
                  <span className="admin-stat-card__value">{avgPct}%</span>
                  <span className="admin-stat-card__label">Avg score</span>
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="spinner-wrap"><div className="spinner" /><span className="spinner-label">Loading...</span></div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <div className="empty-state__icon">⚠️</div>
              <p className="empty-state__title">Could not load history</p>
              <p className="empty-state__desc">{error}</p>
            </div>
          )}

          {!loading && !error && attempts.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">📋</div>
              <p className="empty-state__title">No attempts yet</p>
              <p className="empty-state__desc">
                <Link to="/member/exams" className="btn btn--primary btn--sm" style={{ marginTop: 8 }}>
                  Browse exams
                </Link>
              </p>
            </div>
          )}

          {!loading && !error && attempts.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Exam</th>
                    <th>Score</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => {
                    const p = pct(a);
                    const scoreColor = p == null ? undefined
                      : p >= 80 ? 'var(--color-success)'
                      : p >= 50 ? 'var(--color-warning, #f59e0b)'
                      : 'var(--color-danger)';
                    return (
                      <tr key={a.id}>
                        <td>
                          <Link to={`/member/exams/${a.examId}`} style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
                            {a.examTitle}
                          </Link>
                        </td>
                        <td>
                          {a.scaledScore != null && a.scoreScale != null ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 600, color: scoreColor }}>{a.scaledScore}/{a.scoreScale}</span>
                              {a.passed != null && (
                                <span className={`post-status-badge${a.passed ? ' post-status-badge--published' : ' post-status-badge--draft'}`} style={{ fontSize: 11 }}>
                                  {a.passed ? 'Đạt' : 'Chưa đạt'}
                                </span>
                              )}
                            </span>
                          ) : a.score != null && a.totalPoints != null ? (
                            <span style={{ fontWeight: 600, color: scoreColor }}>
                              {a.score}/{a.totalPoints}
                              {p !== null && <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 4 }}>({p}%)</span>}
                            </span>
                          ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                          {formatDuration(a.durationSeconds)}
                        </td>
                        <td>
                          <span className={`post-status-badge${a.status === 'SUBMITTED' ? ' post-status-badge--published' : ''}`}>
                            {a.status === 'SUBMITTED' ? 'Completed' : 'In progress'}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                          {formatDate(a.submittedAt ?? a.startedAt)}
                        </td>
                        <td>
                          {a.status === 'SUBMITTED' && (
                            <Link to={`/member/attempts/${a.id}`} className="btn btn--ghost btn--sm">
                              View
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <footer className="site-footer">
        <p className="site-footer__text">
          &copy; {new Date().getFullYear()} viettran Blog &mdash;{' '}
          <Link to="/" className="site-footer__link">Home</Link>
        </p>
      </footer>
    </>
  );
}
