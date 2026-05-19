import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { alignCommands } from '../components/editorCommands';
import {
  fetchAdminExam, createExam, updateExam,
  addQuestion, updateQuestion, deleteQuestion,
  uploadContentImage, UnauthorizedError,
} from '../api';
import { logout } from '../auth';
import type { ExamDetailAdmin, QuestionAdmin, OptionAdmin, QuestionType } from '../types';

interface Toast { id: number; message: string; type: 'success' | 'error'; }
let toastId = 0;

interface OptionDraft { id?: number; content: string; correct: boolean; orderIndex: number; }
interface QuestionDraft {
  id?: number;
  content: string;
  orderIndex: number;
  points: number;
  questionType: QuestionType;
  options: OptionDraft[];
  correctTextAnswer: string;
  editing: boolean;
}

function makeBlankQuestion(orderIndex: number): QuestionDraft {
  return {
    content: '',
    orderIndex,
    points: 1,
    questionType: 'SINGLE_CHOICE',
    options: [
      { content: '', correct: true, orderIndex: 0 },
      { content: '', correct: false, orderIndex: 1 },
      { content: '', correct: false, orderIndex: 2 },
      { content: '', correct: false, orderIndex: 3 },
    ],
    correctTextAnswer: '',
    editing: true,
  };
}

function questionFromApi(q: QuestionAdmin): QuestionDraft {
  return {
    id: q.id,
    content: q.content,
    orderIndex: q.orderIndex,
    points: q.points,
    questionType: q.questionType,
    options: q.options.map((o: OptionAdmin) => ({
      id: o.id,
      content: o.content,
      correct: o.correct,
      orderIndex: o.orderIndex,
    })),
    correctTextAnswer: q.correctTextAnswer ?? '',
    editing: false,
  };
}

export default function AdminExamForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [scoreScale, setScoreScale] = useState('');
  const [passScore, setPassScore] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [examId, setExamId] = useState<number | null>(isEdit ? Number(id) : null);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingExam, setLoadingExam] = useState(isEdit);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaSaved, setMetaSaved] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function showToast(message: string, type: 'success' | 'error') {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    fetchAdminExam(Number(id))
      .then((exam) => {
        if (cancelled) return;
        setTitle(exam.title);
        setDescription(exam.description ?? '');
        setTimeLimit(exam.timeLimit != null ? String(exam.timeLimit) : '');
        setScoreScale(exam.scoreScale != null ? String(exam.scoreScale) : '');
        setPassScore(exam.passScore != null ? String(exam.passScore) : '');
        setStatus(exam.status as 'DRAFT' | 'PUBLISHED');
        setExamId(exam.id);
        setQuestions(exam.questions.map(questionFromApi));
        setLoadingExam(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
        setLoadError(err instanceof Error ? err.message : 'Failed to load exam');
        setLoadingExam(false);
      });
    return () => { cancelled = true; };
  }, [id, isEdit, navigate]);

  async function handleSaveMeta(e: React.FormEvent) {
    e.preventDefault();
    setMetaError(null);
    setSavingMeta(true);
    const payload = {
      title,
      description,
      timeLimit: timeLimit ? Number(timeLimit) : null,
      scoreScale: scoreScale ? Number(scoreScale) : null,
      passScore: passScore ? Number(passScore) : null,
      status,
    };
    try {
      let saved: ExamDetailAdmin;
      if (examId) {
        saved = await updateExam(examId, payload);
      } else {
        saved = await createExam(payload);
        setExamId(saved.id);
        navigate(`/admin/exams/${saved.id}/edit`, { replace: true });
      }
      setMetaSaved(true);
      setTimeout(() => setMetaSaved(false), 2000);
      showToast(`"${saved.title}" saved.`, 'success');
    } catch (err) {
      if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
      setMetaError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingMeta(false);
    }
  }

  function addNewQuestion() {
    if (!examId) { showToast('Save the exam details first before adding questions.', 'error'); return; }
    setQuestions((prev) => [...prev, makeBlankQuestion(prev.length)]);
  }

  function updateQuestionDraft(idx: number, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }

  function updateOptionDraft(qIdx: number, oIdx: number, patch: Partial<OptionDraft>) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: q.options.map((o, j) => j === oIdx ? { ...o, ...patch } : o) };
    }));
  }

  function setCorrectOption(qIdx: number, oIdx: number) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: q.options.map((o, j) => ({ ...o, correct: j === oIdx })) };
    }));
  }

  function addOption(qIdx: number) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: [...q.options, { content: '', correct: false, orderIndex: q.options.length }] };
    }));
  }

  function removeOption(qIdx: number, oIdx: number) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const next = q.options.filter((_, j) => j !== oIdx).map((o, j) => ({ ...o, orderIndex: j }));
      return { ...q, options: next };
    }));
  }

  function setQuestionType(qIdx: number, next: QuestionType) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q;
      let opts = q.options;
      if (next === 'SINGLE_CHOICE') {
        let foundFirst = false;
        opts = opts.map((o) => {
          if (o.correct && !foundFirst) { foundFirst = true; return o; }
          return { ...o, correct: false };
        });
        if (!foundFirst && opts.length > 0) opts = [{ ...opts[0], correct: true }, ...opts.slice(1)];
      }
      return { ...q, questionType: next, options: opts };
    }));
  }

  function toggleCorrectMulti(qIdx: number, oIdx: number) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q;
      return { ...q, options: q.options.map((o, j) => j === oIdx ? { ...o, correct: !o.correct } : o) };
    }));
  }

  async function handleSaveQuestion(idx: number) {
    if (!examId) return;
    const q = questions[idx];
    if (!q.content.trim()) { showToast('Question text is required.', 'error'); return; }

    let payload: Parameters<typeof addQuestion>[1];
    if (q.questionType === 'TEXT_INPUT') {
      if (!q.correctTextAnswer.trim()) { showToast('Correct answer is required.', 'error'); return; }
      payload = {
        content: q.content,
        orderIndex: q.orderIndex,
        points: q.points,
        questionType: q.questionType,
        options: [],
        correctTextAnswer: q.correctTextAnswer.trim(),
      };
    } else {
      const nonEmpty = q.options.filter((o) => o.content.trim());
      if (nonEmpty.length < 2) { showToast('At least 2 options are required.', 'error'); return; }
      const hasCorrect = nonEmpty.some((o) => o.correct);
      if (!hasCorrect) { showToast('Mark at least one correct answer.', 'error'); return; }
      payload = {
        content: q.content,
        orderIndex: q.orderIndex,
        points: q.points,
        questionType: q.questionType,
        options: nonEmpty.map((o, i) => ({ content: o.content, correct: o.correct, orderIndex: i })),
        correctTextAnswer: null,
      };
    }
    try {
      let saved: QuestionAdmin;
      if (q.id) {
        saved = await updateQuestion(q.id, payload);
      } else {
        saved = await addQuestion(examId, payload);
      }
      setQuestions((prev) => prev.map((item, i) => i === idx ? questionFromApi(saved) : item));
      showToast('Question saved.', 'success');
    } catch (err) {
      if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
      showToast(err instanceof Error ? err.message : 'Failed to save question', 'error');
    }
  }

  async function handleDeleteQuestion(idx: number) {
    const q = questions[idx];
    if (q.id) {
      if (!window.confirm('Delete this question?')) return;
      try {
        await deleteQuestion(q.id);
        showToast('Question deleted.', 'success');
      } catch (err) {
        if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
        showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
        return;
      }
    }
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
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
            <Link to="/admin/exams" className="admin-topbar__view-site">← Exams</Link>
            <Link to="/" className="admin-topbar__view-site">View site &rarr;</Link>
            <button className="btn--topbar-logout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="admin-posts-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">{isEdit ? 'Edit Exam' : 'New Exam'}</h1>
        </div>

        {loadingExam && (
          <div className="spinner-wrap"><div className="spinner" /><span className="spinner-label">Loading...</span></div>
        )}

        {loadError && (
          <div className="error-banner">
            <span className="error-banner__text">{loadError}</span>
          </div>
        )}

        {!loadingExam && !loadError && (
          <>
            {/* ── Exam Metadata Form ── */}
            <div className="post-form-panel" style={{ marginBottom: 24 }}>
              <div className="post-form-panel__header">
                <h2 className="post-form-panel__title">Exam Details</h2>
              </div>
              {metaError && (
                <div className="error-banner" style={{ marginBottom: 16 }}>
                  <span className="error-banner__text">{metaError}</span>
                </div>
              )}
              <form onSubmit={handleSaveMeta}>
                <div className="post-form-grid">
                  <div className="field field--full">
                    <label className="field__label field__label--required" htmlFor="ef-title">Title</label>
                    <input id="ef-title" className="field__input" type="text" required value={title}
                      placeholder="Exam title" onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="field field--full">
                    <label className="field__label" htmlFor="ef-desc">Description</label>
                    <textarea id="ef-desc" className="field__textarea" rows={3} value={description}
                      placeholder="Optional description..." onChange={(e) => setDescription(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="ef-time">Time Limit (minutes)</label>
                    <input id="ef-time" className="field__input" type="number" min="1" value={timeLimit}
                      placeholder="e.g. 30 (leave blank for no limit)" onChange={(e) => setTimeLimit(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="ef-scale">Thang điểm</label>
                    <input id="ef-scale" className="field__input" type="number" min="1" value={scoreScale}
                      placeholder="e.g. 10 or 100 (để trống = dùng tổng điểm)" onChange={(e) => setScoreScale(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="ef-pass">Điểm đạt (pass score)</label>
                    <input id="ef-pass" className="field__input" type="number" min="0" step="0.1" value={passScore}
                      placeholder={scoreScale ? `0 – ${scoreScale} (để trống = không xét đạt/trượt)` : 'Điền thang điểm trước'}
                      disabled={!scoreScale}
                      onChange={(e) => setPassScore(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field__label">Status</label>
                    <div className="status-toggle">
                      <button type="button"
                        className={`status-toggle__option${status === 'DRAFT' ? ' status-toggle__option--active-draft' : ''}`}
                        onClick={() => setStatus('DRAFT')}>Draft</button>
                      <button type="button"
                        className={`status-toggle__option${status === 'PUBLISHED' ? ' status-toggle__option--active-published' : ''}`}
                        onClick={() => setStatus('PUBLISHED')}>Published</button>
                    </div>
                  </div>
                </div>
                <div className="post-form-actions">
                  <button type="submit" className="btn btn--primary" disabled={savingMeta}>
                    {savingMeta ? 'Saving...' : metaSaved ? 'Saved!' : isEdit ? 'Save details' : 'Create exam'}
                  </button>
                  <Link to="/admin/exams" className="btn btn--ghost">Cancel</Link>
                </div>
              </form>
            </div>

            {/* ── Questions ── */}
            {examId && (
              <div className="post-form-panel">
                <div className="post-form-panel__header">
                  <h2 className="post-form-panel__title">Questions ({questions.length})</h2>
                  <button className="btn btn--accent btn--sm" onClick={addNewQuestion}>+ Add Question</button>
                </div>

                {questions.length === 0 && (
                  <div className="empty-state" style={{ padding: '32px 0' }}>
                    <p className="empty-state__title">No questions yet</p>
                    <p className="empty-state__desc">Click "Add Question" to build your exam.</p>
                  </div>
                )}

                {questions.map((q, qIdx) => (
                  <div key={q.id ?? `new-${qIdx}`} className="exam-question-card">
                    <div className="exam-question-card__header">
                      <span className="exam-question-card__num">Q{qIdx + 1}</span>
                      <div style={{ flex: 1 }} />
                      {!q.editing && (
                        <button className="btn btn--ghost btn--sm" onClick={() => updateQuestionDraft(qIdx, { editing: true })}>Edit</button>
                      )}
                      <button className="btn btn--danger-ghost btn--sm" onClick={() => handleDeleteQuestion(qIdx)}>Delete</button>
                    </div>

                    {!q.editing ? (
                      <div className="exam-question-card__preview">
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 8 }}>
                          <div className="exam-question-card__content exam-md-content" style={{ margin: 0 }}>
                            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{q.content}</ReactMarkdown>
                          </div>
                          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                            background: q.questionType === 'MULTIPLE_CHOICE' ? 'var(--color-accent)'
                              : q.questionType === 'TEXT_INPUT' ? 'var(--color-success)' : 'var(--color-border)',
                            color: q.questionType === 'MULTIPLE_CHOICE' || q.questionType === 'TEXT_INPUT' ? '#fff' : 'var(--color-text-muted)' }}>
                            {q.questionType === 'MULTIPLE_CHOICE' ? 'Multiple choice'
                              : q.questionType === 'TEXT_INPUT' ? 'Fill in the blank' : 'Single choice'}
                          </span>
                        </div>
                        {q.questionType === 'TEXT_INPUT' ? (
                          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                            Đáp án: <strong style={{ color: 'var(--color-text)' }}>{q.correctTextAnswer || '—'}</strong>
                          </p>
                        ) : (
                          <ul className="exam-question-card__options">
                            {q.options.map((o, oIdx) => (
                              <li key={o.id ?? oIdx} className={`exam-option${o.correct ? ' exam-option--correct' : ''}`}>
                                {o.correct ? '✓ ' : '○ '}{o.content}
                              </li>
                            ))}
                          </ul>
                        )}
                        <span className="exam-question-card__points">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                      </div>
                    ) : (
                      <div className="exam-question-card__edit">
                        <div className="field field--full" data-color-mode="light">
                          <label className="field__label" style={{ marginBottom: 6 }}>Question</label>
                          <MDEditor
                            value={q.content}
                            onChange={(val) => updateQuestionDraft(qIdx, { content: val ?? '' })}
                            height={220}
                            preview="live"
                            extraCommands={alignCommands}
                            textareaProps={{
                              placeholder: 'Enter the question text... (Ctrl+V to paste image)',
                              onPaste(e) {
                                const imgItem = Array.from(e.clipboardData.items)
                                  .find((it) => it.type.startsWith('image/'));
                                if (!imgItem) return;
                                const file = imgItem.getAsFile();
                                if (!file) return;
                                e.preventDefault();
                                const start = e.currentTarget.selectionStart;
                                const end = e.currentTarget.selectionEnd;
                                uploadContentImage(file)
                                  .then(({ url }) => {
                                    const snippet = `![pasted-image](${url})`;
                                    setQuestions((prev) => prev.map((item, i) => {
                                      if (i !== qIdx) return item;
                                      const cur = item.content;
                                      const before = cur.slice(0, start);
                                      const after = cur.slice(end);
                                      const sep = before && !before.endsWith('\n') ? '\n\n' : '';
                                      return { ...item, content: before + sep + snippet + '\n' + after };
                                    }));
                                  })
                                  .catch((err) => {
                                    if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); }
                                  });
                              },
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div className="field" style={{ maxWidth: 120 }}>
                            <label className="field__label">Points</label>
                            <input className="field__input" type="number" min="1" value={q.points}
                              onChange={(e) => updateQuestionDraft(qIdx, { points: Number(e.target.value) })} />
                          </div>
                          <div className="field">
                            <label className="field__label">Question Type</label>
                            <div className="status-toggle">
                              <button type="button"
                                className={`status-toggle__option${q.questionType === 'SINGLE_CHOICE' ? ' status-toggle__option--active-draft' : ''}`}
                                onClick={() => q.questionType !== 'SINGLE_CHOICE' && setQuestionType(qIdx, 'SINGLE_CHOICE')}>
                                Single choice
                              </button>
                              <button type="button"
                                className={`status-toggle__option${q.questionType === 'MULTIPLE_CHOICE' ? ' status-toggle__option--active-published' : ''}`}
                                onClick={() => q.questionType !== 'MULTIPLE_CHOICE' && setQuestionType(qIdx, 'MULTIPLE_CHOICE')}>
                                Multiple choice
                              </button>
                              <button type="button"
                                className={`status-toggle__option${q.questionType === 'TEXT_INPUT' ? ' status-toggle__option--active-published' : ''}`}
                                onClick={() => q.questionType !== 'TEXT_INPUT' && setQuestionType(qIdx, 'TEXT_INPUT')}>
                                Fill in blank
                              </button>
                            </div>
                          </div>
                        </div>

                        {q.questionType === 'TEXT_INPUT' ? (
                          <div className="field field--full" style={{ marginTop: 16 }}>
                            <label className="field__label field__label--required">Đáp án đúng</label>
                            <input className="field__input" type="text"
                              placeholder="Nhập đáp án chính xác (so sánh không phân biệt hoa thường)"
                              value={q.correctTextAnswer}
                              onChange={(e) => updateQuestionDraft(qIdx, { correctTextAnswer: e.target.value })} />
                          </div>
                        ) : (
                          <div style={{ marginTop: 16 }}>
                            <p className="field__label" style={{ marginBottom: 8 }}>
                              Answer Options{' '}
                              <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>
                                {q.questionType === 'MULTIPLE_CHOICE'
                                  ? '(check all correct answers)'
                                  : '(select the one correct answer)'}
                              </span>
                            </p>
                            {q.options.map((o, oIdx) => (
                              <div key={oIdx} className="exam-option-row">
                                {q.questionType === 'MULTIPLE_CHOICE' ? (
                                  <input type="checkbox" checked={o.correct}
                                    onChange={() => toggleCorrectMulti(qIdx, oIdx)} />
                                ) : (
                                  <input type="radio" name={`correct-${qIdx}`} checked={o.correct}
                                    onChange={() => setCorrectOption(qIdx, oIdx)} />
                                )}
                                <input className="field__input" type="text" value={o.content}
                                  placeholder={`Option ${oIdx + 1}`}
                                  onChange={(e) => updateOptionDraft(qIdx, oIdx, { content: e.target.value })} />
                                {q.options.length > 2 && (
                                  <button type="button" className="btn btn--danger-ghost btn--sm"
                                    onClick={() => removeOption(qIdx, oIdx)}>✕</button>
                                )}
                              </div>
                            ))}
                            {q.options.length < 6 && (
                              <button type="button" className="btn btn--ghost btn--sm" style={{ marginTop: 8 }}
                                onClick={() => addOption(qIdx)}>+ Add option</button>
                            )}
                          </div>
                        )}

                        <div className="post-form-actions" style={{ marginTop: 16 }}>
                          <button className="btn btn--primary btn--sm" onClick={() => handleSaveQuestion(qIdx)}>Save question</button>
                          {q.id && (
                            <button className="btn btn--ghost btn--sm"
                              onClick={() => updateQuestionDraft(qIdx, { editing: false })}>Cancel</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {questions.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <button className="btn btn--ghost btn--sm" onClick={addNewQuestion}>+ Add another question</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>{toast.message}</div>
      ))}
    </>
  );
}
