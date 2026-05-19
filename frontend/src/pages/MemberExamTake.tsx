import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { fetchMemberExam, startAttempt, submitAttempt, UnauthorizedError } from '../api';
import { memberLogout } from '../memberAuth';
import type { ExamDetailMember, AttemptDetail } from '../types';
import NavBrand from '../components/NavBrand';

type Phase = 'loading' | 'ready' | 'taking' | 'result' | 'error';

function formatTime(secs: number): string {
  if (secs <= 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export default function MemberExamTake() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [exam, setExam] = useState<ExamDetailMember | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<AttemptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchMemberExam(Number(id))
      .then((data) => { if (!cancelled) { setExam(data); setPhase('ready'); } })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) { memberLogout(); navigate('/member/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load exam');
        setPhase('error');
      });
    return () => { cancelled = true; };
  }, [id, navigate]);

  const handleSubmit = useCallback(async (
    currentAnswers: Record<number, number[]>,
    currentTextAnswers: Record<number, string>,
    currentAttemptId: number,
  ) => {
    if (submitting) return;
    setSubmitting(true);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const allQuestionIds = new Set([
      ...Object.keys(currentAnswers).map(Number),
      ...Object.keys(currentTextAnswers).map(Number),
    ]);
    const payload = Array.from(allQuestionIds).map((qId) => ({
      questionId: qId,
      selectedOptionIds: currentAnswers[qId] ?? [],
      textAnswer: currentTextAnswers[qId],
    }));
    try {
      const detail = await submitAttempt(currentAttemptId, payload);
      setResult(detail);
      setPhase('result');
    } catch (err) {
      if (err instanceof UnauthorizedError) { memberLogout(); navigate('/member/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to submit');
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, navigate]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function handleStart() {
    if (!id || !exam) return;
    try {
      const attempt = await startAttempt(Number(id));
      setAttemptId(attempt.id);
      const initOpts: Record<number, number[]> = {};
      const initText: Record<number, string> = {};
      exam.questions.forEach((q) => {
        if (q.questionType === 'TEXT_INPUT') {
          initText[q.id] = '';
        } else {
          initOpts[q.id] = [];
        }
      });
      setAnswers(initOpts);
      setTextAnswers(initText);
      if (exam.timeLimit) {
        const totalSecs = exam.timeLimit * 60;
        setTimeLeft(totalSecs);
        timerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev === null || prev <= 1) {
              if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
              handleSubmit(initOpts, initText, attempt.id);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      setPhase('taking');
    } catch (err) {
      if (err instanceof UnauthorizedError) { memberLogout(); navigate('/member/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to start exam');
      setPhase('error');
    }
  }

  function handleSingleAnswer(questionId: number, optionId: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: [optionId] }));
  }

  function handleMultiAnswer(questionId: number, optionId: number) {
    setAnswers((prev) => {
      const cur = prev[questionId] ?? [];
      const next = cur.includes(optionId) ? cur.filter((id) => id !== optionId) : [...cur, optionId];
      return { ...prev, [questionId]: next };
    });
  }

  function handleManualSubmit() {
    if (!attemptId) return;
    const optAnswered = Object.values(answers).filter((v) => v.length > 0).length;
    const textAnswered = Object.values(textAnswers).filter((v) => v.trim().length > 0).length;
    const answered = optAnswered + textAnswered;
    const total = exam?.questions.length ?? 0;
    if (answered < total) {
      if (!window.confirm(`You have ${total - answered} unanswered question(s). Submit anyway?`)) return;
    }
    handleSubmit(answers, textAnswers, attemptId);
  }

  const answeredCount = Object.values(answers).filter((v) => v.length > 0).length
    + Object.values(textAnswers).filter((v) => v.trim().length > 0).length;
  const totalQuestions = exam?.questions.length ?? 0;

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

          {phase === 'loading' && (
            <div className="spinner-wrap"><div className="spinner" /><span className="spinner-label">Loading...</span></div>
          )}

          {phase === 'error' && (
            <div className="empty-state">
              <div className="empty-state__icon">⚠️</div>
              <p className="empty-state__title">Error</p>
              <p className="empty-state__desc">{error}</p>
              <Link to="/member/exams" className="btn btn--primary" style={{ marginTop: 16 }}>Back to exams</Link>
            </div>
          )}

          {phase === 'ready' && exam && (
            <div className="exam-start-card">
              <h1 className="series-detail__title">{exam.title}</h1>
              {exam.description && <p className="series-detail__desc">{exam.description}</p>}
              <div className="exam-start-meta">
                <span>{exam.questionCount} question{exam.questionCount !== 1 ? 's' : ''}</span>
                {exam.timeLimit && <span>⏱ {exam.timeLimit} minutes</span>}
              </div>
              <button className="btn btn--primary" style={{ marginTop: 24 }} onClick={handleStart}>
                Start Exam
              </button>
            </div>
          )}

          {phase === 'taking' && exam && (
            <>
              {/* Timer bar */}
              {timeLeft !== null && (
                <div className={`exam-timer${timeLeft < 60 ? ' exam-timer--urgent' : ''}`}>
                  <span>⏱ Time remaining: <strong>{formatTime(timeLeft)}</strong></span>
                </div>
              )}

              <div className="exam-progress">
                <span>{answeredCount}/{totalQuestions} answered</span>
              </div>

              <h1 className="series-detail__title" style={{ marginBottom: 24 }}>{exam.title}</h1>

              <ol className="exam-question-list">
                {exam.questions.map((q, idx) => {
                  const isText = q.questionType === 'TEXT_INPUT';
                  const isMulti = q.questionType === 'MULTIPLE_CHOICE';
                  const selected = answers[q.id] ?? [];
                  return (
                    <li key={q.id} className="exam-take-question">
                      <div className="exam-take-question__header">
                        <span className="exam-take-question__num">Question {idx + 1}</span>
                        {isMulti && (
                          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4,
                            background: 'var(--color-accent)', color: '#fff' }}>
                            Select all that apply
                          </span>
                        )}
                        {isText && (
                          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4,
                            background: 'var(--color-success)', color: '#fff' }}>
                            Fill in the blank
                          </span>
                        )}
                        <span className="exam-take-question__pts">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="exam-take-question__content exam-md-content">
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{q.content}</ReactMarkdown>
                      </div>
                      {isText ? (
                        <div className="exam-take-options">
                          <textarea
                            className="field__textarea"
                            rows={3}
                            placeholder="Nhập câu trả lời của bạn..."
                            value={textAnswers[q.id] ?? ''}
                            onChange={(e) => setTextAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            style={{ width: '100%', resize: 'vertical' }}
                          />
                        </div>
                      ) : (
                        <div className="exam-take-options">
                          {q.options.map((opt) => {
                            const checked = selected.includes(opt.id);
                            return (
                              <label
                                key={opt.id}
                                className={`exam-take-option${checked ? ' exam-take-option--selected' : ''}`}
                              >
                                {isMulti ? (
                                  <input type="checkbox" value={opt.id} checked={checked}
                                    onChange={() => handleMultiAnswer(q.id, opt.id)} />
                                ) : (
                                  <input type="radio" name={`q-${q.id}`} value={opt.id} checked={checked}
                                    onChange={() => handleSingleAnswer(q.id, opt.id)} />
                                )}
                                <span>{opt.content}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                <button className="btn btn--primary" onClick={handleManualSubmit} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit exam'}
                </button>
                <Link to="/member/exams" className="btn btn--ghost">Cancel</Link>
              </div>
            </>
          )}

          {phase === 'result' && result && (
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
                </p>
              </div>

              <ol className="exam-result-list">
                {result.answers.map((ans, idx) => (
                  <li key={ans.questionId} className={`exam-result-item${ans.correct ? ' exam-result-item--correct' : ' exam-result-item--wrong'}`}>
                    <div className="exam-result-item__header">
                      <span className="exam-result-item__num">Q{idx + 1}</span>
                      <span className="exam-result-item__verdict">{ans.correct ? '✓ Correct' : '✗ Wrong'}</span>
                    </div>
                    <p className="exam-result-item__question">{ans.questionContent}</p>
                    {ans.questionType === 'TEXT_INPUT' ? (
                      <>
                        {ans.textAnswer ? (
                          <p className="exam-result-item__answer">
                            Your answer: <strong>{ans.textAnswer}</strong>
                          </p>
                        ) : (
                          <p className="exam-result-item__answer" style={{ color: 'var(--color-text-muted)' }}>No answer</p>
                        )}
                        {!ans.correct && ans.correctTextAnswer && (
                          <p className="exam-result-item__correct">
                            Correct answer: <strong>{ans.correctTextAnswer}</strong>
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        {ans.selectedOptionContents.length > 0 ? (
                          <p className="exam-result-item__answer">
                            Your answer: <strong>{ans.selectedOptionContents.join(', ')}</strong>
                          </p>
                        ) : (
                          <p className="exam-result-item__answer" style={{ color: 'var(--color-text-muted)' }}>No answer</p>
                        )}
                        {!ans.correct && ans.correctOptionContents.length > 0 && (
                          <p className="exam-result-item__correct">
                            Correct answer: <strong>{ans.correctOptionContents.join(', ')}</strong>
                          </p>
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
