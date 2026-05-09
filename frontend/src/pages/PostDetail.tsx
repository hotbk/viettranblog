import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { fetchPostBySlug } from '../api';
import type { BlogPost } from '../types';

function formatDate(value: string | null): string {
  if (!value) return 'Unpublished';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(value));
}

export default function PostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
