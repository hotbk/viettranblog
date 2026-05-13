import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPosts, fetchPublicExams } from './api';
import type { BlogPost, ExamSummary } from './types';
import { isAuthenticated } from './auth';
import { isMemberAuthenticated } from './memberAuth';
import NavBrand from './components/NavBrand';

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
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const isMember = isMemberAuthenticated();

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

  useEffect(() => {
    fetchPublicExams().then(setExams).catch(() => { /* non-critical */ });
  }, []);

  const authenticated = isAuthenticated();

  return (
    <>
      {/* ── Navbar ─────────────────────────────── */}
      <nav className="site-nav">
        <div className="site-nav__inner">
          <NavBrand />
          <div className="site-nav__links">
            <Link to="/" className="site-nav__link">Home</Link>
            <Link to="/series" className="site-nav__link">Series</Link>
            {isMember ? (
              <Link to="/member/exams" className="site-nav__link">Exams</Link>
            ) : (
              <Link to="/member/login" className="site-nav__link">Exams</Link>
            )}
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
        <div className="hero__inner">
          <p className="hero__eyebrow">✦ Personal Blog</p>
          <h1 className="hero__title">viettran Blog</h1>
          <p className="hero__tagline">Thoughts on technology &amp; life — software, data, and things worth sharing.</p>
        </div>
        {!loading && posts.length > 0 && (
          <div className="hero__stats">
            <div className="hero__stat">
              <span className="hero__stat-value">{posts.length}</span>
              <span className="hero__stat-label">Posts</span>
            </div>
            <div className="hero__stat">
              <span className="hero__stat-value">{categories.length}</span>
              <span className="hero__stat-label">Topics</span>
            </div>
            <div className="hero__stat">
              <span className="hero__stat-value">
                {Array.from(new Set(posts.flatMap((p) => p.tags))).length}
              </span>
              <span className="hero__stat-label">Tags</span>
            </div>
          </div>
        )}
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

      {/* ── Exams section ──────────────────────── */}
      {exams.length > 0 && (
        <div className="container" style={{ marginTop: 48, marginBottom: 32 }}>
          <div className="home-exams-header">
            <p className="section-label">Quizzes &amp; Exams</p>
            <p className="home-exams-sub">Test your knowledge — sign in with a member account to take a quiz.</p>
          </div>
          <div className="home-exams-grid">
            {exams.map((exam) => (
              <div key={exam.id} className="home-exam-card">
                <div className="home-exam-card__top">
                  <h3 className="home-exam-card__title">{exam.title}</h3>
                  <span className="home-exam-card__badge">{exam.questionCount} Q{exam.timeLimit ? ` · ${exam.timeLimit}m` : ''}</span>
                </div>
                {exam.description && (
                  <p className="home-exam-card__desc">{exam.description}</p>
                )}
                <div className="home-exam-card__action">
                  {isMember ? (
                    <Link to={`/member/exams/${exam.id}`} className="btn btn--primary btn--sm">Start exam</Link>
                  ) : (
                    <Link to="/member/login" className="btn btn--ghost btn--sm">Sign in to take</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          {isMember && (
            <div style={{ marginTop: 16 }}>
              <Link to="/member/exams" className="btn btn--ghost btn--sm">View all exams →</Link>
            </div>
          )}
        </div>
      )}

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
        <span className="post-card__views">{(post.viewCount ?? 0).toLocaleString()} views</span>
      </div>
    </article>
  );
}
