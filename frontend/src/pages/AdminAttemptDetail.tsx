import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { fetchAdminAttemptDetail, UnauthorizedError } from '../api';
import { logout } from '../auth';
import type { AdminAttemptDetail } from '../types';

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export default function AdminAttemptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<AdminAttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchAdminAttemptDetail(Number(id))
      .then((data) => { if (!cancelled) { setAttempt(data); setLoading(false); } })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, navigate]);

  function handleLogout() { logout(); navigate('/admin/login'); }

  const pct = attempt?.totalPoints && attempt.totalPoints > 0
    ? Math.round(((attempt.score ?? 0) / attempt.totalPoints) * 100)
    : null;

  return (
    <>
      <header className="admin-topbar">
        <div className="admin-topbar__inner">
          <div className="admin-topbar__brand">
            <span className="admin-topbar__brand-name">viettran Blog</span>
            <span className="admin-topbar__brand-sub">Admin Panel</span>
          </div>
          <div className="admin-topbar__actions">
            <Link to="/admin/attempts" className="admin-topbar__view-site">← Attempts</Link>
            <Link to="/" className="admin-topbar__view-site">View site &rarr;</Link>
            <button className="btn--topbar-logout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="admin-posts-page">
        {loading && (
          <div className="spinner-wrap"><div className="spinner" /><span className="spinner-label">Loading...</span></div>
        )}
        {!loading && error && (
          <div className="error-banner"><span className="error-banner__text">{error}</span></div>
        )}

        {!loading && !error && attempt && (
          <>
            <div className="admin-page-header">
              <h1 className="admin-page-title">Attempt #{attempt.id}</h1>
            </div>

            {/* Summary card */}
            <div className="post-form-panel" style={{ marginBottom: 24 }}>
              <div className="post-form-panel__header">
                <h2 className="post-form-panel__title">Summary</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, padding: '8px 0' }}>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>User</p>
                  <p style={{ fontWeight: 600 }}>{attempt.username}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Exam</p>
                  <Link to={`/admin/exams/${attempt.examId}/edit`} style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
                    {attempt.examTitle}
                  </Link>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Score</p>
                  <p style={{ fontWeight: 700, fontSize: 20 }}>
                    {attempt.scaledScore != null
                      ? <>{attempt.scaledScore}/{attempt.scoreScale}</>
                      : <>{attempt.score ?? '—'}/{attempt.totalPoints ?? '—'}{pct !== null && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 6 }}>({pct}%)</span>}</>
                    }
                  </p>
                  {attempt.passed != null && (
                    <span className={`post-status-badge${attempt.passed ? ' post-status-badge--published' : ' post-status-badge--draft'}`}>
                      {attempt.passed ? 'Đạt' : 'Chưa đạt'}
                    </span>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Started</p>
                  <p>{formatDate(attempt.startedAt)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Submitted</p>
                  <p>{formatDate(attempt.submittedAt)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Status</p>
                  <span className={`post-status-badge${attempt.status === 'SUBMITTED' ? ' post-status-badge--published' : ''}`}>
                    {attempt.status === 'SUBMITTED' ? 'Submitted' : 'In progress'}
                  </span>
                </div>
              </div>
            </div>

            {/* Answers */}
            <div className="post-form-panel">
              <div className="post-form-panel__header">
                <h2 className="post-form-panel__title">Answers ({attempt.answers.length})</h2>
              </div>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {attempt.answers.map((ans, idx) => (
                  <li key={ans.questionId}
                    className={`exam-result-item${ans.correct ? ' exam-result-item--correct' : ' exam-result-item--wrong'}`}
                    style={{ marginBottom: 12 }}>
                    <div className="exam-result-item__header">
                      <span className="exam-result-item__num">Q{idx + 1}</span>
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4,
                        background: ans.questionType === 'MULTIPLE_CHOICE' ? 'var(--color-accent)' : 'var(--color-border)',
                        color: ans.questionType === 'MULTIPLE_CHOICE' ? '#fff' : 'var(--color-text-muted)' }}>
                        {ans.questionType === 'MULTIPLE_CHOICE' ? 'Multiple' : 'Single'}
                      </span>
                      <span className="exam-result-item__verdict">{ans.correct ? '✓ Correct' : '✗ Wrong'}</span>
                    </div>
                    <div className="exam-result-item__question exam-md-content">
                      <ReactMarkdown rehypePlugins={[rehypeRaw]}>{ans.questionContent}</ReactMarkdown>
                    </div>
                    {ans.selectedOptionContents.length > 0 ? (
                      <p className="exam-result-item__answer">
                        Answer: <strong>{ans.selectedOptionContents.join(', ')}</strong>
                      </p>
                    ) : (
                      <p className="exam-result-item__answer" style={{ color: 'var(--color-text-muted)' }}>No answer</p>
                    )}
                    {!ans.correct && ans.correctOptionContents.length > 0 && (
                      <p className="exam-result-item__correct">
                        Correct: <strong>{ans.correctOptionContents.join(', ')}</strong>
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>
    </>
  );
}
