import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchMemberExams, fetchMyAttempts, UnauthorizedError } from '../api';
import { memberLogout } from '../memberAuth';
import type { ExamSummary, AttemptSummary } from '../types';
import NavBrand from '../components/NavBrand';

export default function MemberExams() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMemberExams(), fetchMyAttempts()])
      .then(([examsData, attemptsData]) => {
        if (!cancelled) { setExams(examsData); setAttempts(attemptsData); setError(null); }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) { memberLogout(); navigate('/member/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [navigate]);

  function getExamAttempts(examId: number) {
    return attempts.filter((a) => a.examId === examId);
  }

  function handleLogout() { memberLogout(); navigate('/member/login'); }

  return (
    <>
      <nav className="site-nav">
        <div className="site-nav__inner">
          <NavBrand />
          <div className="site-nav__links">
            <Link to="/" className="site-nav__link">Home</Link>
            <Link to="/series" className="site-nav__link">Series</Link>
            <Link to="/member/history" className="site-nav__link">History</Link>
            <button className="btn btn--ghost btn--sm" onClick={handleLogout} style={{ marginLeft: 8 }}>Sign out</button>
          </div>
        </div>
      </nav>

      <div className="series-list-page">
        <div className="container">
          <h1 className="series-list__heading">Exams</h1>
          <p className="series-list__desc">Take a quiz and test your knowledge.</p>

          {loading && (
            <div className="spinner-wrap"><div className="spinner" /><span className="spinner-label">Loading...</span></div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <div className="empty-state__icon">⚠️</div>
              <p className="empty-state__title">Could not load exams</p>
              <p className="empty-state__desc">{error}</p>
            </div>
          )}

          {!loading && !error && exams.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">📝</div>
              <p className="empty-state__title">No exams available</p>
              <p className="empty-state__desc">Check back soon.</p>
            </div>
          )}

          {!loading && !error && exams.length > 0 && (
            <div className="series-card-grid">
              {exams.map((exam) => {
                const myAttempts = getExamAttempts(exam.id);
                const submitted = myAttempts.filter((a) => a.status === 'SUBMITTED');
                const best = submitted.length > 0
                  ? submitted.reduce((a, b) => (a.score ?? 0) >= (b.score ?? 0) ? a : b)
                  : null;
                return (
                  <div key={exam.id} className="series-card">
                    <div className="series-card__header">
                      <h2 className="series-card__title">{exam.title}</h2>
                      <span className="series-card__badge">{exam.questionCount} Q</span>
                    </div>
                    {exam.description && <p className="series-card__desc">{exam.description}</p>}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                      {exam.timeLimit && (
                        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>⏱ {exam.timeLimit} min</span>
                      )}
                      {best && (
                        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                          Best: {best.score}/{best.totalPoints}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <Link to={`/member/exams/${exam.id}`} className="btn btn--primary btn--sm">
                        {submitted.length > 0 ? 'Take again' : 'Start exam'}
                      </Link>
                      {submitted.length > 0 && (
                        <Link to={`/member/attempts/${submitted[submitted.length - 1].id}`}
                          className="btn btn--ghost btn--sm" style={{ marginLeft: 8 }}>
                          Last result
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
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
