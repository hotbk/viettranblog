import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { fetchAbout } from '../api';
import type { AboutContent } from '../types';
import SiteNav from '../components/SiteNav';
import { useSeo } from '../useSeo';

export default function AboutPage() {
  const [about, setAbout] = useState<AboutContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAbout()
      .then((data) => { if (!cancelled) setAbout(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useSeo(
    about && about.updatedAt
      ? {
          title: about.title || 'About',
          description: about.content ? about.content.slice(0, 160) : 'About this blog.',
          path: '/about',
        }
      : { title: 'About', description: 'About this blog.', noindex: true }
  );

  return (
    <>
      <SiteNav active="about" />

      <div className="post-detail-page">
        <div className="post-detail__narrow">
          {loading && (
            <div className="spinner-wrap">
              <div className="spinner" />
              <span className="spinner-label">Loading...</span>
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <div className="empty-state__icon">&#9888;&#65039;</div>
              <p className="empty-state__title">Couldn't load this page</p>
              <p className="empty-state__desc">{error}</p>
              <Link to="/" className="btn btn--primary" style={{ marginTop: 16 }}>Go home</Link>
            </div>
          )}

          {/* Not configured yet — admin hasn't saved any About content */}
          {!loading && !error && about && !about.updatedAt && (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden>📝</div>
              <p className="empty-state__title">This page is still being written.</p>
              <p className="empty-state__desc">Check back soon to learn more about this blog.</p>
              <Link to="/" className="btn btn--ghost" style={{ marginTop: 16 }}>Back to posts</Link>
            </div>
          )}

          {!loading && !error && about && about.updatedAt && (
            <article>
              <h1 className="post-detail__title">{about.title || 'About'}</h1>
              <div className="post-detail__divider" />
              <div className="post-detail__content">
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>{about.content}</ReactMarkdown>
              </div>
            </article>
          )}
        </div>
      </div>

      <footer className="site-footer">
        <p className="site-footer__text">
          &copy; {new Date().getFullYear()} TECH2BLOGS &mdash;{' '}
          <Link to="/" className="site-footer__link">Home</Link>
        </p>
        <p className="site-footer__credit">Made by Viet Tran Tuan</p>
      </footer>
    </>
  );
}
