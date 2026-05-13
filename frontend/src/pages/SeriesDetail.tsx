import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchSeriesBySlug } from '../api';
import type { SeriesDetail as SeriesDetailType } from '../types';
import NavBrand from '../components/NavBrand';

export default function SeriesDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [series, setSeries] = useState<SeriesDetailType | null>(null);
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading = loadedSlug !== slug;

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetchSeriesBySlug(slug)
      .then((data) => {
        if (!cancelled) { setSeries(data); setError(null); setLoadedSlug(slug); }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Not found');
          setLoadedSlug(slug);
        }
      });
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <>
      <nav className="site-nav">
        <div className="site-nav__inner">
          <NavBrand />
          <div className="site-nav__links">
            <Link to="/" className="site-nav__link">Home</Link>
            <Link to="/series" className="site-nav__link">Series</Link>
          </div>
        </div>
      </nav>

      <div className="series-detail-page">
        <div className="container">
          <Link to="/series" className="back-link">← All series</Link>

          {loading && (
            <div className="spinner-wrap">
              <div className="spinner" />
              <span className="spinner-label">Loading...</span>
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <div className="empty-state__icon">📭</div>
              <p className="empty-state__title">Series not found</p>
              <p className="empty-state__desc">{error}</p>
              <Link to="/series" className="btn btn--primary" style={{ marginTop: 16 }}>
                Back to series
              </Link>
            </div>
          )}

          {!loading && series && (
            <>
              <div className="series-detail__header">
                <h1 className="series-detail__title">{series.title}</h1>
                <span className="series-detail__count">{series.postCount} {series.postCount === 1 ? 'post' : 'posts'}</span>
              </div>
              {series.description && (
                <p className="series-detail__desc">{series.description}</p>
              )}

              {series.posts.length === 0 ? (
                <div className="empty-state" style={{ marginTop: 32 }}>
                  <p className="empty-state__title">No posts in this series yet</p>
                </div>
              ) : (
                <ol className="series-post-list">
                  {series.posts.map((item) => (
                    <li key={item.postId} className="series-post-item">
                      <span className="series-post-item__num">{item.position}</span>
                      <div className="series-post-item__body">
                        {item.status === 'PUBLISHED' ? (
                          <Link to={`/posts/${item.slug}`} className="series-post-item__title">
                            {item.title}
                          </Link>
                        ) : (
                          <span className="series-post-item__title series-post-item__title--draft">
                            {item.title}
                            <span className="badge badge--draft">Unpublished</span>
                          </span>
                        )}
                        {item.excerpt && (
                          <p className="series-post-item__excerpt">{item.excerpt}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
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
