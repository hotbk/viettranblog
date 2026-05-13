import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSeries } from '../api';
import type { SeriesSummary } from '../types';
import NavBrand from '../components/NavBrand';

export default function SeriesList() {
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSeries()
      .then((data) => { if (!cancelled) setSeries(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <nav className="site-nav">
        <div className="site-nav__inner">
          <NavBrand />
          <div className="site-nav__links">
            <Link to="/" className="site-nav__link">Home</Link>
            <Link to="/series" className="site-nav__link site-nav__link--active">Series</Link>
          </div>
        </div>
      </nav>

      <div className="series-list-page">
        <div className="container">
          <h1 className="series-list__heading">Series</h1>
          <p className="series-list__desc">Posts grouped by topic — read them in order from start to finish.</p>

          {loading && (
            <div className="spinner-wrap">
              <div className="spinner" />
              <span className="spinner-label">Loading...</span>
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <div className="empty-state__icon">⚠️</div>
              <p className="empty-state__title">Could not load series</p>
              <p className="empty-state__desc">{error}</p>
            </div>
          )}

          {!loading && !error && series.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">📚</div>
              <p className="empty-state__title">No series yet</p>
              <p className="empty-state__desc">Check back soon.</p>
            </div>
          )}

          {!loading && !error && series.length > 0 && (
            <div className="series-card-grid">
              {series.map((s) => (
                <Link key={s.id} to={`/series/${s.slug}`} className="series-card">
                  <div className="series-card__header">
                    <h2 className="series-card__title">{s.title}</h2>
                    <span className="series-card__badge">{s.postCount} {s.postCount === 1 ? 'post' : 'posts'}</span>
                  </div>
                  {s.description && (
                    <p className="series-card__desc">{s.description}</p>
                  )}
                </Link>
              ))}
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
