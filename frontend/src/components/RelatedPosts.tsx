import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRelatedPosts } from '../api';
import type { RelatedPost } from '../types';

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

/**
 * Right-hand sidebar widget on the post-detail page. Fetches its own data
 * (same self-contained pattern as CommentSection) so PostDetail doesn't have
 * to sequence two requests before it can render.
 */
export default function RelatedPosts({ slug }: { slug: string }) {
  const [posts, setPosts] = useState<RelatedPost[]>([]);
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading = loadedSlug !== slug;

  useEffect(() => {
    let cancelled = false;
    fetchRelatedPosts(slug)
      .then((data) => {
        if (!cancelled) { setPosts(data); setError(null); setLoadedSlug(slug); }
      })
      .catch(() => {
        if (!cancelled) { setError('Failed to load related posts'); setLoadedSlug(slug); }
      });
    return () => { cancelled = true; };
  }, [slug]);

  return (
    <aside className="related-posts" aria-labelledby="related-posts-heading">
      <h2 id="related-posts-heading" className="related-posts__title">Related Posts</h2>

      {loading && (
        <div className="spinner-wrap" style={{ padding: '16px 0' }}>
          <div className="spinner" />
          <span className="spinner-label">Loading...</span>
        </div>
      )}

      {!loading && error && (
        <p className="related-posts__error">{error}</p>
      )}

      {!loading && !error && posts.length === 0 && (
        <p className="related-posts__empty">No related posts yet.</p>
      )}

      {!loading && !error && posts.length > 0 && (
        <ul className="related-posts__list">
          {posts.map((post) => (
            <li key={post.id} className="related-posts__item">
              <Link to={`/posts/${post.slug}`} className="related-posts__link">
                {post.hasCoverImage && post.coverImageUrl && (
                  <img src={post.coverImageUrl} alt="" className="related-posts__thumb" />
                )}
                <div className="related-posts__body">
                  {post.category && (
                    <span className="related-posts__category">{post.category}</span>
                  )}
                  <span className="related-posts__item-title">{post.title}</span>
                  {post.publishedAt && (
                    <span className="related-posts__date">{formatDate(post.publishedAt)}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
