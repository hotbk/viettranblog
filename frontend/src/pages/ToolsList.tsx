import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTools } from '../api';
import type { Tool } from '../types';
import SiteNav from '../components/SiteNav';
import { useSeo } from '../useSeo';
import { categoryColorClass } from '../categoryColor';

function SkeletonGrid() {
  return (
    <div className="skeleton-grid">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="skeleton-card">
          <div className="skeleton-block" style={{ height: 18, width: '40%' }} />
          <div className="skeleton-block" style={{ height: 24, width: '85%' }} />
          <div className="skeleton-block" style={{ height: 14, width: '100%', marginTop: 4 }} />
          <div className="skeleton-block" style={{ height: 14, width: '75%' }} />
        </div>
      ))}
    </div>
  );
}

/** Public listing for interactive HTML/CSS/JS tools (calculators, checklists,
 * diagrams) — same grid/filter shape as LibraryPage, minus the
 * file-type/locked/read-progress bits Tool doesn't have. */
export default function ToolsList() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    return Array.from(new Set(tools.map((t) => t.category).filter((c): c is string => !!c))).sort();
  }, [tools]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTools({ q: query, category });
      setTools(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  useSeo({
    title: 'Tools',
    description: 'Interactive calculators, diagrams, and checklists — run directly in your browser.',
    path: '/tools',
  });

  return (
    <>
      <SiteNav active="tools" />

      <section className="hero">
        <div className="hero__inner">
          <p className="hero__eyebrow">✦ Tools</p>
          <h1 className="hero__title">Interactive Tools</h1>
          <p className="hero__tagline">Calculators, diagrams, and checklists you can run right in the browser.</p>
        </div>
      </section>

      <div className="container container--wide">
        <div className="filters-bar">
          <div className="filters-bar__inner">
            <div className="filters-bar__search">
              <span className="filters-bar__search-icon">&#128269;</span>
              <input
                className="filters-bar__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools..."
                aria-label="Search tools"
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
              {tools.length} result{tools.length !== 1 ? 's' : ''}
              {query ? ` for "${query}"` : ''}
              {category ? ` in ${category}` : ''}
            </p>
          )}
          {!loading && !query && !category && <p className="section-label">All tools</p>}

          {loading && <SkeletonGrid />}

          {!loading && error && (
            <div className="error-banner">
              <span className="error-banner__text">{error}</span>
              <button className="error-banner__retry" onClick={load}>Retry</button>
            </div>
          )}

          {!loading && !error && tools.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">&#128295;</div>
              <p className="empty-state__title">No tools found</p>
              <p className="empty-state__desc">
                {query || category ? 'Try a different search term or category.' : 'Check back soon.'}
              </p>
            </div>
          )}

          {!loading && !error && tools.length > 0 && (
            <div className="post-grid">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </section>
      </div>

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

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <article className="post-card">
      {tool.hasCoverImage && tool.coverImageUrl ? (
        <img src={tool.coverImageUrl} alt={tool.title} className="post-card__cover" />
      ) : (
        <div className="post-card__cover book-card__cover-placeholder" aria-hidden>🔧</div>
      )}
      <div className="post-card__meta">
        {tool.category && (
          <span className={`post-card__category ${categoryColorClass(tool.category)}`}>{tool.category}</span>
        )}
        <span className="post-card__date">{tool.viewCount.toLocaleString()} views</span>
      </div>

      <h2 className="post-card__title">
        <Link to={`/tools/${tool.slug}`} className="post-card__title-link">{tool.title}</Link>
      </h2>

      {tool.excerpt && <p className="post-card__excerpt">{tool.excerpt}</p>}

      {tool.tags.length > 0 && (
        <div className="post-card__tags">
          {tool.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="post-card__tag">#{tag}</span>
          ))}
        </div>
      )}

      <div className="post-card__footer">
        <Link to={`/tools/${tool.slug}`} className="post-card__read-more">Open →</Link>
      </div>
    </article>
  );
}
