import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchToolBySlug, recordToolView } from '../api';
import type { Tool } from '../types';
import SiteNav from '../components/SiteNav';
import { useSeo } from '../useSeo';

const DEFAULT_IFRAME_HEIGHT = 720;
// Sanity bounds on a self-reported height from postMessage — a misbehaving or
// hostile tool could otherwise post an absurd value and break page layout.
const MIN_IFRAME_HEIGHT = 200;
const MAX_IFRAME_HEIGHT = 4000;

/**
 * Public artifact page. The tool's actual markup never touches this app's DOM
 * or origin: the iframe loads GET /api/tools/{slug}/raw directly, sandboxed
 * with `allow-scripts` and deliberately *not* `allow-same-origin` — the tool
 * can run its JS, but cannot read this page's cookies/localStorage/DOM, and
 * (the flip side of the same restriction) this page cannot read the tool's
 * DOM either. That's why height is fixed by default rather than measured:
 * a cross-origin-sandboxed iframe can't be introspected from the parent.
 * A tool's own script can opt into auto-sizing by posting
 * `{ type: 'tool-resize', height }` to the parent (documented in the admin
 * form) — this listens for that, but doesn't require it.
 */
export default function ToolDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState(DEFAULT_IFRAME_HEIGHT);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setIframeHeight(DEFAULT_IFRAME_HEIGHT);
      try {
        const data = await fetchToolBySlug(slug!);
        if (!cancelled) setTool(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    recordToolView(slug);
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const data = event.data as { type?: string; height?: number };
      if (data?.type === 'tool-resize' && typeof data.height === 'number') {
        const clamped = Math.min(MAX_IFRAME_HEIGHT, Math.max(MIN_IFRAME_HEIGHT, Math.round(data.height)));
        setIframeHeight(clamped);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useSeo(
    tool
      ? { title: tool.title, description: tool.excerpt ?? `${tool.title} — an interactive tool.`, path: `/tools/${tool.slug}` }
      : { title: 'Tool', description: 'Interactive tool.', noindex: true }
  );

  return (
    <>
      <SiteNav active="tools" />

      <div className="post-detail-page tool-detail-page">
        <div className="container">
          <Link to="/tools" className="back-link">Back to tools</Link>

          {loading && (
            <div className="spinner-wrap">
              <div className="spinner" />
              <span className="spinner-label">Loading tool...</span>
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <div className="empty-state__icon">&#9888;&#65039;</div>
              <p className="empty-state__title">Couldn't load this tool</p>
              <p className="empty-state__desc">{error}</p>
            </div>
          )}

          {!loading && !error && tool && (
            <div className="post-detail__narrow">
              <div className="post-detail__category-row">
                {tool.category && <span className="post-detail__category">{tool.category}</span>}
                <span className="post-detail__views">{tool.viewCount.toLocaleString()} views</span>
              </div>
              <h1 className="post-detail__title">{tool.title}</h1>
              {tool.excerpt && <p className="tool-detail__excerpt">{tool.excerpt}</p>}

              {tool.tags.length > 0 && (
                <div className="post-detail__tags">
                  {tool.tags.map((tag) => (
                    <span key={tag} className="post-detail__tag">#{tag}</span>
                  ))}
                </div>
              )}

              <div className="post-detail__divider" />

              <iframe
                ref={iframeRef}
                src={tool.rawUrl}
                title={tool.title}
                className="tool-detail__frame"
                style={{ height: iframeHeight }}
                sandbox="allow-scripts"
              />
            </div>
          )}
        </div>
      </div>

      <footer className="site-footer">
        <p className="site-footer__text">
          &copy; {new Date().getFullYear()} TECH2BLOGS &mdash;{' '}
          <Link to="/" className="site-footer__link">Home</Link> &mdash;{' '}
          <Link to="/tools" className="site-footer__link">Tools</Link>
        </p>
        <p className="site-footer__credit">Made by Viet Tran Tuan</p>
      </footer>
    </>
  );
}
