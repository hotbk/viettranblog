import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchAdminAttempts, fetchAdminExams, UnauthorizedError } from '../api';
import { logout } from '../auth';
import type { AdminAttemptSummary, ExamSummary } from '../types';

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

function ScoreBadge({ score, total, scaledScore, scoreScale, passed }: {
  score: number | null; total: number | null;
  scaledScore: number | null; scoreScale: number | null; passed: boolean | null;
}) {
  if (scaledScore != null && scoreScale != null) {
    const pct = Math.round((scaledScore / scoreScale) * 100);
    const color = pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning, #f59e0b)' : 'var(--color-danger)';
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 600, color }}>{scaledScore}/{scoreScale}</span>
        {passed != null && (
          <span className={`post-status-badge${passed ? ' post-status-badge--published' : ' post-status-badge--draft'}`} style={{ fontSize: 11 }}>
            {passed ? 'Đạt' : 'Chưa đạt'}
          </span>
        )}
      </span>
    );
  }
  if (score == null || total == null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const color = pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning, #f59e0b)' : 'var(--color-danger)';
  return <span style={{ fontWeight: 600, color }}>{score}/{total} <span style={{ fontSize: 12, fontWeight: 400 }}>({pct}%)</span></span>;
}

export default function AdminAttempts() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<AdminAttemptSummary[]>([]);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [filterExamId, setFilterExamId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [attemptsData, examsData] = await Promise.all([
          fetchAdminAttempts(filterExamId ? Number(filterExamId) : undefined),
          exams.length === 0 ? fetchAdminExams() : Promise.resolve(exams),
        ]);
        setAttempts(attemptsData);
        if (exams.length === 0) setExams(examsData);
        setError(null);
      } catch (err) {
        if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterExamId, navigate]);

  const filtered = search.trim()
    ? attempts.filter((a) =>
        a.username.toLowerCase().includes(search.toLowerCase()) ||
        a.examTitle.toLowerCase().includes(search.toLowerCase()))
    : attempts;

  const submitted = filtered.filter((a) => a.status === 'SUBMITTED');
  const avgPct = submitted.length > 0 && submitted.every((a) => a.totalPoints)
    ? Math.round(submitted.reduce((acc, a) => acc + ((a.score ?? 0) / (a.totalPoints ?? 1)) * 100, 0) / submitted.length)
    : null;

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
            <Link to="/admin/exams" className="admin-topbar__view-site">Exams</Link>
            <Link to="/admin/users" className="admin-topbar__view-site">Users</Link>
            <Link to="/" className="admin-topbar__view-site">View site &rarr;</Link>
            <button className="btn--topbar-logout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="admin-posts-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Attempt History</h1>
        </div>

        {/* Stats bar */}
        <div className="admin-stats-row" style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="admin-stat-card">
            <span className="admin-stat-card__value">{filtered.length}</span>
            <span className="admin-stat-card__label">Total attempts</span>
          </div>
          <div className="admin-stat-card">
            <span className="admin-stat-card__value">{submitted.length}</span>
            <span className="admin-stat-card__label">Submitted</span>
          </div>
          {avgPct !== null && (
            <div className="admin-stat-card">
              <span className="admin-stat-card__value">{avgPct}%</span>
              <span className="admin-stat-card__label">Avg score</span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            className="field__input"
            style={{ maxWidth: 220 }}
            type="text"
            placeholder="Search by user or exam..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field__input"
            style={{ maxWidth: 240 }}
            value={filterExamId}
            onChange={(e) => setFilterExamId(e.target.value)}
          >
            <option value="">All exams</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.title}</option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="spinner-wrap"><div className="spinner" /><span className="spinner-label">Loading...</span></div>
        )}

        {!loading && error && (
          <div className="error-banner"><span className="error-banner__text">{error}</span></div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state" style={{ padding: '48px 0' }}>
            <div className="empty-state__icon">📋</div>
            <p className="empty-state__title">No attempts found</p>
            <p className="empty-state__desc">No exam attempts match the current filter.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Exam</th>
                  <th>Score</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{a.id}</td>
                    <td><strong>{a.username}</strong></td>
                    <td>
                      <Link to={`/admin/exams/${a.examId}/edit`} className="admin-table__link">
                        {a.examTitle}
                      </Link>
                    </td>
                    <td><ScoreBadge score={a.score} total={a.totalPoints} scaledScore={a.scaledScore} scoreScale={a.scoreScale} passed={a.passed} /></td>
                    <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{formatDuration(a.durationSeconds)}</td>
                    <td>
                      <span className={`post-status-badge${a.status === 'SUBMITTED' ? ' post-status-badge--published' : ''}`}>
                        {a.status === 'SUBMITTED' ? 'Submitted' : 'In progress'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{formatDate(a.startedAt)}</td>
                    <td style={{ fontSize: 13 }}>{formatDate(a.submittedAt)}</td>
                    <td>
                      {a.status === 'SUBMITTED' && (
                        <Link to={`/admin/attempts/${a.id}`} className="btn btn--ghost btn--sm">
                          Detail
                        </Link>
                      )}
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
