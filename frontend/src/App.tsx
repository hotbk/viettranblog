import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPosts, fetchPublicExams } from './api';
import type { BlogPost, ExamSummary } from './types';
import { isMemberAuthenticated } from './memberAuth';
import SiteNav from './components/SiteNav';
import TagCloud from './components/TagCloud';
import { useSeo } from './useSeo';
import { categoryColorClass } from './categoryColor';
import { getLanguagePreference, languageQueryParam, setLanguagePreference, type LanguagePreference } from './contentLanguage';
import { getShowTagCloud, setShowTagCloud } from './tagCloudPrefs';

const HOME_DESCRIPTION =
  'Practical PostgreSQL, Oracle, Kubernetes, and AI engineering notes: performance tuning, ' +
  'production incidents, DBA playbooks, and applied AI workflows from real systems.';

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
  // Read synchronously from localStorage — no extra async step, no flash of
  // the wrong language (docs/10-multilingual-content.md §4.5).
  const [languagePref, setLanguagePref] = useState<LanguagePreference>(() => getLanguagePreference());
  const isMember = isMemberAuthenticated();

  // Tag cloud: a client-side quick-filter over the already-fetched `posts`
  // (no server round trip — tags aren't a queryable column, see
  // PostRepository.search's comment), plus a per-browser show/hide
  // preference (tagCloudPrefs.ts, same pattern as theme.ts).
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showTagCloud, setShowTagCloudState] = useState(() => getShowTagCloud());

  function handleToggleTagCloud(show: boolean) {
    setShowTagCloudState(show);
    setShowTagCloud(show);
  }

  const categories = useMemo(() => {
    return Array.from(new Set(posts.map((post) => post.category).filter(Boolean))).sort();
  }, [posts]);

  const displayedPosts = useMemo(() => {
    if (!selectedTag) return posts;
    return posts.filter((post) => post.tags.includes(selectedTag));
  }, [posts, selectedTag]);

  async function loadPosts() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPosts({ q: query, category, language: languageQueryParam(languagePref) });
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
  }, [query, category, languagePref]);

  // A new server-side search/category/language change supersedes the tag
  // quick-filter — otherwise a tag pick from a previous result set could
  // silently zero out an unrelated new search. Cleared at each of those
  // three call sites directly (not a reactive effect on their state) —
  // react-hooks/set-state-in-effect flags the effect-based version as an
  // avoidable cascading render.
  function handleQueryChange(next: string) {
    setQuery(next);
    setSelectedTag(null);
  }

  function handleCategoryChange(next: string) {
    setCategory(next);
    setSelectedTag(null);
  }

  function handleShowAllLanguages() {
    setLanguagePreference('ALL');
    setLanguagePref('ALL');
    setSelectedTag(null);
  }

  function handleLanguageChange(pref: LanguagePreference) {
    setLanguagePref(pref);
    setSelectedTag(null);
  }

  useEffect(() => {
    fetchPublicExams().then(setExams).catch(() => { /* non-critical */ });
  }, []);

  useSeo({
    title: 'Database, DevOps, DBA & AI Engineering Blog',
    description: HOME_DESCRIPTION,
    path: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'TECH2BLOGS',
      description: HOME_DESCRIPTION,
      url: window.location.origin,
    },
  });

  return (
    <>
      {/* ── Navbar ─────────────────────────────── */}
      <SiteNav active="home" onLanguageChange={handleLanguageChange} />

      {/* ── Hero ───────────────────────────────── */}
      <section className="hero">
        <div className="hero__inner">
          <p className="hero__eyebrow">✦ Database · DevOps · DBA · AI</p>
          <h1 className="hero__title">
            TECH2BLOGS
            <span className="hero__title-sub"> — Database, DevOps &amp; AI Engineering Notes</span>
          </h1>
          <p className="hero__tagline">{HOME_DESCRIPTION}</p>
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
        {!loading && !error && (
          <TagCloud
            posts={posts}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            visible={showTagCloud}
            onToggleVisible={handleToggleTagCloud}
          />
        )}

        <div className="filters-bar">
          <div className="filters-bar__inner">
            <div className="filters-bar__search">
              <span className="filters-bar__search-icon">&#128269;</span>
              <input
                className="filters-bar__input"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search posts..."
                aria-label="Search posts"
              />
            </div>
            <select
              className="filters-bar__select"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
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
          {!loading && (query || category || selectedTag) && (
            <p className="section-label">
              {displayedPosts.length} result{displayedPosts.length !== 1 ? 's' : ''}
              {query ? ` for "${query}"` : ''}
              {category ? ` in ${category}` : ''}
              {selectedTag ? ` tagged #${selectedTag}` : ''}
              {selectedTag && (
                <button type="button" className="section-label__clear-tag" onClick={() => setSelectedTag(null)}>
                  Clear tag ×
                </button>
              )}
            </p>
          )}
          {!loading && !query && !category && !selectedTag && (
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

          {/* Empty — nothing came back from the server at all */}
          {!loading && !error && posts.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">&#128203;</div>
              <p className="empty-state__title">
                {languagePref === 'ALL'
                  ? 'No posts found'
                  : `No ${languagePref === 'VI' ? 'Vietnamese' : 'English'} posts yet.`}
              </p>
              <p className="empty-state__desc">
                {query || category
                  ? 'Try a different search term or category.'
                  : languagePref === 'ALL'
                    ? 'Check back soon — new posts are on the way.'
                    : 'This article may only exist in the other language so far.'}
              </p>
              {languagePref !== 'ALL' && (
                <button className="btn btn--ghost" onClick={handleShowAllLanguages} style={{ marginTop: 16 }}>
                  Show all languages
                </button>
              )}
            </div>
          )}

          {/* Empty — the tag quick-filter narrowed an otherwise non-empty result set to nothing */}
          {!loading && !error && posts.length > 0 && displayedPosts.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">&#127991;&#65039;</div>
              <p className="empty-state__title">No posts tagged #{selectedTag}</p>
              <p className="empty-state__desc">The tag cloud is built from this same result set — try a different tag.</p>
              <button className="btn btn--ghost" onClick={() => setSelectedTag(null)} style={{ marginTop: 16 }}>
                Clear tag filter
              </button>
            </div>
          )}

          {/* Post grid */}
          {!loading && !error && displayedPosts.length > 0 && (
            <div className="post-grid">
              {displayedPosts.map((post) => (
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
          &copy; {new Date().getFullYear()} TECH2BLOGS &mdash;{' '}
          <Link to="/about" className="site-footer__link">About</Link> &mdash;{' '}
          <Link to="/admin/login" className="site-footer__link">Admin</Link>
        </p>
        <p className="site-footer__credit">Made by Viet Tran Tuan</p>
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
          <span className={`post-card__category ${categoryColorClass(post.category)}`}>{post.category}</span>
        )}
        <span className="post-card__date">{formatDate(post.publishedAt)}</span>
        {post.visibility === 'PRIVATE' && (
          <span className="post-card__private-badge" title="Private post">🔒 Private</span>
        )}
      </div>

      <h2 className="post-card__title">
        <Link to={`/posts/${post.slug}`} className="post-card__title-link">{post.title}</Link>
      </h2>

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
