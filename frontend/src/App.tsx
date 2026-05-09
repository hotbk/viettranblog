import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPosts } from './api';
import type { BlogPost } from './types';
import { isAuthenticated } from './auth';

function formatDate(value: string | null): string {
  if (!value) return 'Unpublished';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

function SkeletonGrid() {
  return (
    <div className="skeleton-grid">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="skeleton-card">
          <div className="skeleton-block" style={{ height: 18, width: '40%' }} />
          <div className="skeleton-block" style={{ height: 24, width: '85%' }} />
          <div className="skeleton-block" style={{ height: 14, width: '100%', marginTop: 4 }} />
          <div className="skeleton-block" style={{ height: 14, width: '75%' }} />
          <div className="skeleton-block" style={{ height: 14, width: '60%' }} />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    return Array.from(new Set(posts.map((post) => post.category).filter(Boolean))).sort();
  }, [posts]);

  async function loadPosts() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPosts({ q: query, category });
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPosts();
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  const authenticated = isAuthenticated();

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
            {authenticated ? (
              <Link to="/admin/posts" className="site-nav__link site-nav__link--accent">Admin</Link>
            ) : (
              <Link to="/admin/login" className="site-nav__link">Admin</Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────── */}
      <section className="hero">
        <p className="hero__eyebrow">Personal Blog</p>
        <h1 className="hero__title">viettran Blog</h1>
        <p className="hero__tagline">Thoughts on technology &amp; life — software, data, and things worth sharing.</p>
      </section>

      {/* ── Post List ──────────────────────────── */}
      <div className="container">
        <div className="filters-bar">
          <div className="filters-bar__inner">
            <div className="filters-bar__search">
              <span className="filters-bar__search-icon">&#128269;</span>
              <input
                className="filters-bar__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search posts..."
                aria-label="Search posts"
              />
            </div>
            <select
              className="filters-bar__select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        <section className="post-section">
          {!loading && (query || category) && (
            <p className="section-label">
              {posts.length} result{posts.length !== 1 ? 's' : ''}
              {query ? ` for "${query}"` : ''}
              {category ? ` in ${category}` : ''}
            </p>
          )}
          {!loading && !query && !category && (
            <p className="section-label">Latest posts</p>
          )}

          {/* Loading skeleton */}
          {loading && <SkeletonGrid />}

          {/* Error */}
          {!loading && error && (
            <div className="error-banner">
              <span className="error-banner__text">{error}</span>
              <button className="error-banner__retry" onClick={loadPosts}>Retry</button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && posts.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">&#128203;</div>
              <p className="empty-state__title">No posts found</p>
              <p className="empty-state__desc">
                {query || category
                  ? 'Try a different search term or category.'
                  : 'Check back soon — new posts are on the way.'}
              </p>
            </div>
          )}

          {/* Post grid */}
          {!loading && !error && posts.length > 0 && (
            <div className="post-grid">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="site-footer">
        <p className="site-footer__text">
          &copy; {new Date().getFullYear()} viettran Blog &mdash;{' '}
          <Link to="/admin/login" className="site-footer__link">Admin</Link>
        </p>
      </footer>
    </>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="post-card">
      {post.hasCoverImage && post.coverImageUrl && (
        <img
          src={post.coverImageUrl}
          alt={post.title}
          className="post-card__cover"
        />
      )}
      <div className="post-card__meta">
        {post.category && (
          <span className="post-card__category">{post.category}</span>
        )}
        <span className="post-card__date">{formatDate(post.publishedAt)}</span>
      </div>

      <h2 className="post-card__title">{post.title}</h2>

      {post.excerpt && (
        <p className="post-card__excerpt">{post.excerpt}</p>
      )}

      {post.tags.length > 0 && (
        <div className="post-card__tags">
          {post.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="post-card__tag">#{tag}</span>
          ))}
        </div>
      )}

      <div className="post-card__footer">
        <Link to={`/posts/${post.slug}`} className="post-card__read-more">
          Read more
        </Link>
      </div>
    </article>
  );
}
