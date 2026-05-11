import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { fetchPostBySlug, fetchComments, submitComment } from '../api';
import type { CommentRequest } from '../api';
import type { BlogPost, Comment } from '../types';

function formatDate(value: string | null): string {
  if (!value) return 'Unpublished';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(value));
}

function readingTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

function useReadingProgress() {
  useEffect(() => {
    function update() {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      const pct = total > 0 ? Math.round((scrolled / total) * 100) : 0;
      document.documentElement.style.setProperty('--reading-progress', `${pct}%`);
    }
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
}

export default function PostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useReadingProgress();

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPostBySlug(slug!);
        if (!cancelled) setPost(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Post not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <>
      <div className="reading-progress" aria-hidden />

      {/* ── Navbar ─────────────────────────────── */}
      <nav className="site-nav">
        <div className="site-nav__inner">
          <Link to="/" className="site-nav__brand">
            <div className="site-nav__logo">VT</div>
            <span className="site-nav__name">viettran Blog</span>
          </Link>
          <div className="site-nav__links">
            <Link to="/" className="site-nav__link">Home</Link>
          </div>
        </div>
      </nav>

      <div className="post-detail-page">
        <div className="container">
          <button className="back-link" onClick={() => navigate(-1)}>
            Back to posts
          </button>

          {/* Loading */}
          {loading && (
            <div className="spinner-wrap">
              <div className="spinner" />
              <span className="spinner-label">Loading post...</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="empty-state">
              <div className="empty-state__icon">&#128197;</div>
              <p className="empty-state__title">Post not found</p>
              <p className="empty-state__desc">{error}</p>
              <Link to="/" className="btn btn--primary" style={{ marginTop: 16 }}>
                Go home
              </Link>
            </div>
          )}

          {/* Post content */}
          {!loading && post && (
            <article>
              <div className="post-detail__category-row">
                {post.category && (
                  <span className="post-detail__category">{post.category}</span>
                )}
                <span className="post-detail__date">{formatDate(post.publishedAt)}</span>
                <span className="post-detail__reading-time">{readingTime(post.content)}</span>
              </div>

              <h1 className="post-detail__title">{post.title}</h1>

              {post.hasCoverImage && post.coverImageUrl && (
                <img
                  src={post.coverImageUrl}
                  alt={post.title}
                  className="post-detail__cover"
                />
              )}

              {post.tags.length > 0 && (
                <div className="post-detail__tags">
                  {post.tags.map((tag) => (
                    <span key={tag} className="post-detail__tag">#{tag}</span>
                  ))}
                </div>
              )}

              <div className="post-detail__divider" />

              <p className="post-detail__content">{post.content}</p>
            </article>
          )}

          {/* Comment section — only show when post loaded */}
          {!loading && post && <CommentSection slug={post.slug} />}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="site-footer">
        <p className="site-footer__text">
          &copy; {new Date().getFullYear()} viettran Blog &mdash;{' '}
          <Link to="/" className="site-footer__link">Home</Link>
        </p>
      </footer>
    </>
  );
}

// ── CommentSection ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#1a2744', '#2d4a8a', '#3d5278', '#b45309',
  '#065f46', '#6d28d9', '#be185d', '#0f766e',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const EMPTY_FORM: CommentRequest = { authorName: '', authorEmail: '', content: '' };

function formatCommentDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

function CommentSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CommentRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchComments(slug)
      .then((data) => { if (!cancelled) setComments(data); })
      .catch(() => { if (!cancelled) setError('Failed to load comments'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  function validate(): string | null {
    if (!form.authorName.trim()) return 'Name is required';
    if (form.authorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.authorEmail))
      return 'Invalid email format';
    if (!form.content.trim()) return 'Comment cannot be empty';
    if (form.content.trim().length < 3) return 'Comment is too short';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setFormError(err); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      const created = await submitComment(slug, {
        authorName: form.authorName.trim(),
        authorEmail: form.authorEmail?.trim() || undefined,
        content: form.content.trim(),
      });
      setComments((prev) => [...prev, created]);
      setForm(EMPTY_FORM);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit comment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="comment-section">
      <h2 className="comment-section__title">
        Comments {!loading && `(${comments.length})`}
      </h2>

      {/* ── Comment list ── */}
      {loading && (
        <div className="spinner-wrap" style={{ padding: '24px 0' }}>
          <div className="spinner" />
          <span className="spinner-label">Loading comments...</span>
        </div>
      )}

      {!loading && error && (
        <p className="comment-section__error">{error}</p>
      )}

      {!loading && !error && comments.length === 0 && (
        <p className="comment-section__empty">No comments yet. Be the first to comment!</p>
      )}

      {!loading && !error && comments.length > 0 && (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment-item">
              <div
                className="comment-item__avatar"
                style={{ background: avatarColor(c.authorName) }}
                aria-hidden
              >
                {initials(c.authorName)}
              </div>
              <div className="comment-item__body">
                <div className="comment-item__meta">
                  <span className="comment-item__author">{c.authorName}</span>
                  <span className="comment-item__date">{formatCommentDate(c.createdAt)}</span>
                </div>
                <p className="comment-item__content">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Comment form ── */}
      <div className="comment-form-wrap">
        <h3 className="comment-form__heading">Leave a comment</h3>

        {submitted && (
          <div className="comment-form__success">Comment submitted successfully!</div>
        )}

        {formError && (
          <div className="comment-form__error">{formError}</div>
        )}

        <form onSubmit={handleSubmit} noValidate className="comment-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="c-name">
                Name <span className="form-required">*</span>
              </label>
              <input
                id="c-name"
                className="form-input"
                value={form.authorName}
                onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                placeholder="Your name"
                maxLength={100}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="c-email">
                Email <span className="form-optional">(optional)</span>
              </label>
              <input
                id="c-email"
                type="email"
                className="form-input"
                value={form.authorEmail}
                onChange={(e) => setForm({ ...form, authorEmail: e.target.value })}
                placeholder="your@email.com"
                maxLength={100}
              />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label" htmlFor="c-content">
              Comment <span className="form-required">*</span>
            </label>
            <textarea
              id="c-content"
              className="form-input form-textarea"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Write your comment..."
              rows={4}
              maxLength={2000}
            />
            <div className="form-char-count">{form.content.length}/2000</div>
          </div>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Comment'}
          </button>
        </form>
      </div>
    </section>
  );
}
