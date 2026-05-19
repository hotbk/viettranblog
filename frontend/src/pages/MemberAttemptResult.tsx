import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { fetchAttemptDetail, UnauthorizedError } from '../api';
import { memberLogout } from '../memberAuth';
import type { AttemptDetail } from '../types';
import NavBrand from '../components/NavBrand';

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
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export default function MemberAttemptResult() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    fetchAttemptDetail(Number(attemptId))
      .then((data) => { if (!cancelled) { setResult(data); setError(null); } })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) { memberLogout(); navigate('/member/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load result');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attemptId, navigate]);

  return (
    <>
      <nav className="site-nav">
        <div className="site-nav__inner">
          <NavBrand />
          <div className="site-nav__links">
            <Link to="/member/exams" className="site-nav__link">← Exams</Link>
          </div>
        </div>
      </nav>

      <div className="series-detail-page">
        <div className="container">
          <Link to="/member/exams" className="back-link">← All exams</Link>

          {loading && (
            <div className="spinner-wrap"><div className="spinner" /><span className="spinner-label">Loading...</span></div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <div className="empty-state__icon">⚠️</div>
              <p className="empty-state__title">Result not found</p>
              <p className="empty-state__desc">{error}</p>
              <Link to="/member/exams" className="btn btn--primary" style={{ marginTop: 16 }}>Back to exams</Link>
            </div>
          )}

          {!loading && result && (
            <>
              <div className="exam-result-header">
                <h1 className="series-detail__title">{result.examTitle}</h1>
                <div className="exam-result-score">
                  {result.scaledScore != null ? (
                    <>
                      <span className="exam-result-score__num">{result.scaledScore}</span>
                      <span className="exam-result-score__sep">/</span>
                      <span className="exam-result-score__total">{result.scoreScale}</span>
                    </>
                  ) : (
                    <>
                      <span className="exam-result-score__num">{result.score}</span>
                      <span className="exam-result-score__sep">/</span>
                      <span className="exam-result-score__total">{result.totalPoints}</span>
                    </>
                  )}
                </div>
                {result.scaledScore == null && (
                  <p className="exam-result-pct">
                    {result.totalPoints
                      ? `${Math.round(((result.score ?? 0) / result.totalPoints) * 100)}%`
                      : '—'}
                  </p>
                )}
                {result.passed != null && (
                  <p className={`exam-result-verdict${result.passed ? ' exam-result-verdict--pass' : ' exam-result-verdict--fail'}`}>
                    {result.passed ? '✓ Đạt' : '✗ Chưa đạt'}
                    {result.passScore != null && <span style={{ fontWeight: 400, fontSize: 14 }}> (điểm đạt: {result.passScore}/{result.scoreScale})</span>}
                  </p>
                )}
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Submitted: {formatDate(result.submittedAt)}
                  {result.durationSeconds != null && (
                    <span style={{ marginLeft: 12 }}>· Duration: {formatDuration(result.durationSeconds)}</span>
                  )}
                </p>
              </div>

              <ol className="exam-result-list">
                {result.answers.map((ans, idx) => (
                  <li key={ans.questionId} className={`exam-result-item${ans.correct ? ' exam-result-item--correct' : ' exam-result-item--wrong'}`}>
                    <div className="exam-result-item__header">
                      <span className="exam-result-item__num">Q{idx + 1}</span>
                      <span className="exam-result-item__verdict">{ans.correct ? '✓ Correct' : '✗ Wrong'}</span>
                    </div>
                    <div className="exam-result-item__question exam-md-content">
                      <ReactMarkdown rehypePlugins={[rehypeRaw]}>{ans.questionContent}</ReactMarkdown>
                    </div>
                    {ans.questionType === 'TEXT_INPUT' ? (
                      <>
                        {ans.textAnswer ? (
                          <p className="exam-result-item__answer">Your answer: <strong>{ans.textAnswer}</strong></p>
                        ) : (
                          <p className="exam-result-item__answer" style={{ color: 'var(--color-text-muted)' }}>No answer</p>
                        )}
                        {!ans.correct && ans.correctTextAnswer && (
                          <p className="exam-result-item__correct">Correct answer: <strong>{ans.correctTextAnswer}</strong></p>
                        )}
                      </>
                    ) : (
                      <>
                        {ans.selectedOptionContents.length > 0 ? (
                          <p className="exam-result-item__answer">Your answer: <strong>{ans.selectedOptionContents.join(', ')}</strong></p>
                        ) : (
                          <p className="exam-result-item__answer" style={{ color: 'var(--color-text-muted)' }}>No answer</p>
                        )}
                        {!ans.correct && ans.correctOptionContents.length > 0 && (
                          <p className="exam-result-item__correct">Correct answer: <strong>{ans.correctOptionContents.join(', ')}</strong></p>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ol>

              <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                <Link to={`/member/exams/${result.examId}`} className="btn btn--primary">Take again</Link>
                <Link to="/member/exams" className="btn btn--ghost">Back to exams</Link>
              </div>
            </>
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
