import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { fetchPostBySlug, recordPostView, fetchComments, submitComment, PostAccessDeniedError, createAccessRequest } from '../api';
import type { CommentRequest } from '../api';
import type { BlogPost, Comment, AccessDenialCode } from '../types';
import { isAuthenticated } from '../auth';
import { isMemberAuthenticated } from '../memberAuth';
import SiteNav from '../components/SiteNav';
import RelatedPosts from '../components/RelatedPosts';
import PostAttachments from '../components/PostAttachments';
import TranslationSwitcher from '../components/TranslationSwitcher';
import { useSeo } from '../useSeo';
import { LANGUAGE_BCP47 } from '../types';

const DENIAL_COPY: Record<AccessDenialCode, { title: string; desc: string }> = {
  NOT_AUTHENTICATED: {
    title: 'This article is private.',
    desc: 'Please sign in to continue.',
  },
  ACCOUNT_PENDING: {
    title: 'Your account is awaiting approval.',
    desc: 'An admin needs to approve your account before you can access private articles.',
  },
  ACCOUNT_REJECTED: {
    title: 'Your account registration was not approved.',
    desc: 'Contact an admin if you believe this is a mistake.',
  },
  ACCOUNT_SUSPENDED: {
    title: 'Your account has been suspended.',
    desc: 'Contact an admin for more information.',
  },
  NO_ACCESS: {
    title: "You don't have permission to access this article.",
    desc: 'You can request access from an admin below.',
  },
};

function formatDate(value: string | null): string {
  if (!value) return 'Unpublished';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(value));
}

function readingTime(content: string | null): string {
  if (!content) return '';
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
  const [denial, setDenial] = useState<AccessDenialCode | null>(null);

  useReadingProgress();

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setDenial(null);
      try {
        const data = await fetchPostBySlug(slug!);
        if (!cancelled) {
          setPost(data);
          recordPostView(slug!);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof PostAccessDeniedError) {
          setDenial(err.code);
        } else {
          setError(err instanceof Error ? err.message : 'Post not found');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  // Self-inclusive, reciprocal hreflang set for this page's <head> (docs/10 §5.2) —
  // the sitemap is the primary channel (docs/10 §5.1), this is the secondary one.
  // Built from PUBLISHED siblings only; a published original also gets an x-default
  // pointing at itself when there is no unpublished-original ambiguity to resolve here
  // (the backend's `translations` already omits DRAFT siblings for public callers).
  const publishedSiblings = post ? post.translations.filter((t) => t.status === 'PUBLISHED') : [];
  const alternates = post && publishedSiblings.length > 0
    ? [
        { hreflang: LANGUAGE_BCP47[post.language], path: `/posts/${post.slug}` },
        ...publishedSiblings.map((t) => ({ hreflang: LANGUAGE_BCP47[t.language], path: `/posts/${t.slug}` })),
      ]
    : undefined;

  useSeo(
    post
      ? {
          title: post.title,
          description: post.excerpt || `Read "${post.title}" on TECH2BLOGS.`,
          path: `/posts/${post.slug}`,
          type: 'article',
          image: post.hasCoverImage && post.coverImageUrl
            ? window.location.origin + post.coverImageUrl
            : undefined,
          lang: LANGUAGE_BCP47[post.language],
          alternates,
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt || undefined,
            datePublished: post.publishedAt ?? undefined,
            dateModified: post.updatedAt,
            author: { '@type': 'Organization', name: 'TECH2BLOGS' },
            publisher: { '@type': 'Organization', name: 'TECH2BLOGS' },
            mainEntityOfPage: window.location.origin + `/posts/${post.slug}`,
          },
        }
      : {
          // Loading, not-found, or access-denied — never index these transient/gated states.
          title: 'Post',
          description: 'TECH2BLOGS article.',
          noindex: true,
        }
  );

  return (
    <>
      <div className="reading-progress" aria-hidden />

      {/* ── Navbar ─────────────────────────────── */}
      <SiteNav />

      <div className="post-detail-page">
        <div className="container">
          <button className="back-link" onClick={() => navigate(-1)}>
            Back to posts
          </button>

          <div className="post-detail__narrow">
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

            {/* Private post — denied, with the specific reason (see spec §10) */}
            {!loading && denial && (
              <div className="empty-state private-denied">
                <div className="empty-state__icon" aria-hidden>🔒</div>
                <p className="empty-state__title">{DENIAL_COPY[denial].title}</p>
                <p className="empty-state__desc">{DENIAL_COPY[denial].desc}</p>
                <div className="private-denied__actions">
                  {denial === 'NOT_AUTHENTICATED' && (
                    <>
                      <Link to="/member/login" className="btn btn--primary">Sign in</Link>
                      <Link to="/" className="btn btn--ghost">Go home</Link>
                    </>
                  )}
                  {denial === 'NO_ACCESS' && (isAuthenticated() || isMemberAuthenticated()) && (
                    <RequestAccessButton slug={slug!} />
                  )}
                  {denial !== 'NOT_AUTHENTICATED' && (
                    <Link to="/" className="btn btn--ghost">Go home</Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Post content + sidebar */}
          {!loading && post && (
          <div className="post-detail__layout">
          <div className="post-detail__main">
            <article>
              <div className="post-detail__category-row">
                {post.category && (
                  <span className="post-detail__category">{post.category}</span>
                )}
                <span className="post-detail__date">{formatDate(post.publishedAt)}</span>
                <span className="post-detail__reading-time">{readingTime(post.content)}</span>
                <span className="post-detail__views">{(post.viewCount ?? 0).toLocaleString()} views</span>
              </div>

              <h1 className="post-detail__title">{post.title}</h1>

              <TranslationSwitcher
                translations={post.translations}
                publicPath={(slug) => `/posts/${slug}`}
                adminEditPath={() => '/admin/posts'}
              />

              {post.seriesInfo && (
                <div className="series-nav">
                  <span className="series-nav__label">
                    Post {post.seriesInfo.position}/{post.seriesInfo.totalPosts} in series:{' '}
                    <Link to={`/series/${post.seriesInfo.seriesSlug}`} className="series-nav__series-link">
                      {post.seriesInfo.seriesTitle}
                    </Link>
                  </span>
                  <div className="series-nav__btns">
                    {post.seriesInfo.prevPostSlug ? (
                      <Link to={`/posts/${post.seriesInfo.prevPostSlug}`} className="btn btn--sm btn--ghost series-nav__btn">
                        ← Previous
                      </Link>
                    ) : (
                      <span className="btn btn--sm btn--ghost series-nav__btn series-nav__btn--disabled">← Previous</span>
                    )}
                    {post.seriesInfo.nextPostSlug ? (
                      <Link to={`/posts/${post.seriesInfo.nextPostSlug}`} className="btn btn--sm btn--primary series-nav__btn">
                        Next →
                      </Link>
                    ) : (
                      <span className="btn btn--sm btn--primary series-nav__btn series-nav__btn--disabled">Next →</span>
                    )}
                  </div>
                </div>
              )}

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

              <div className="post-detail__content">
                <ReactMarkdown
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className ?? '');
                      const inline = !match;
                      if (inline) {
                        return <code className="inline-code" {...props}>{children}</code>;
                      }
                      return (
                        <SyntaxHighlighter
                          style={oneLight}
                          language={match[1]}
                          PreTag="div"
                          customStyle={{ borderRadius: 8, fontSize: 14, margin: '1em 0' }}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      );
                    },
                  }}
                >
                  {post.content ?? ''}
                </ReactMarkdown>
              </div>

              <PostAttachments attachments={post.attachments} />
            </article>

            <CommentSection slug={post.slug} />
          </div>

          <RelatedPosts slug={post.slug} />
          </div>
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="site-footer">
        <p className="site-footer__text">
          &copy; {new Date().getFullYear()} TECH2BLOGS &mdash;{' '}
          <Link to="/" className="site-footer__link">Home</Link> &mdash;{' '}
          <Link to="/about" className="site-footer__link">About</Link>
        </p>
        <p className="site-footer__credit">Made by Viet Tran Tuan</p>
      </footer>
    </>
  );
}

// ── RequestAccessButton ─────────────────────────────────────────────────────────

function RequestAccessButton({ slug }: { slug: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleRequest() {
    setState('sending');
    try {
      await createAccessRequest(slug, message.trim() || undefined);
      setState('sent');
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return <p className="private-denied__sent">Access request sent — an admin will review it.</p>;
  }

  return (
    <div className="private-denied__request">
      <textarea
        className="field__textarea"
        rows={2}
        placeholder="Optional message to the admin..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
      />
      <button
        type="button"
        className="btn btn--primary"
        onClick={handleRequest}
        disabled={state === 'sending'}
      >
        {state === 'sending' ? 'Sending...' : 'Request Access'}
      </button>
      {state === 'error' && (
        <p className="private-denied__error">Could not send the request — it may already be pending.</p>
      )}
    </div>
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
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading = loadedSlug !== slug;

  const [form, setForm] = useState<CommentRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchComments(slug)
      .then((data) => {
        if (!cancelled) { setComments(data); setError(null); setLoadedSlug(slug); }
      })
      .catch(() => {
        if (!cancelled) { setError('Failed to load comments'); setLoadedSlug(slug); }
      });
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
