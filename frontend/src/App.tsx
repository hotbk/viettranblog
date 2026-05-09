import { useEffect, useMemo, useState } from 'react';
import { fetchPostBySlug, fetchPosts } from './api';
import type { BlogPost } from './types';

function App() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    return Array.from(new Set(posts.map((post) => post.category).filter(Boolean))).sort();
  }, [posts]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadPosts();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, category]);

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

  async function openPost(slug: string) {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchPostBySlug(slug);
      setSelectedPost(data);
      window.history.pushState(null, '', `/posts/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  function goHome() {
    setSelectedPost(null);
    window.history.pushState(null, '', '/');
  }

  if (selectedPost) {
    return (
      <main className="page">
        <button className="link-button" onClick={goHome}>← Back to posts</button>
        <article className="post-detail">
          <p className="meta">{selectedPost.category} · {formatDate(selectedPost.publishedAt)}</p>
          <h1>{selectedPost.title}</h1>
          <div className="tags">
            {selectedPost.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <p className="content">{selectedPost.content}</p>
        </article>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Personal Blog</p>
        <h1>Writing about technology, data, management, and personal learning.</h1>
        <p className="subtitle">A clean React + Spring Boot blog scaffold designed to be extended by Claude Code agents.</p>
      </header>

      <section className="filters" aria-label="Post filters">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search posts..."
          aria-label="Search posts"
        />
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </section>

      {loading && <p className="state">Loading posts...</p>}
      {error && <p className="state error">{error}</p>}
      {!loading && !error && posts.length === 0 && <p className="state">No posts found.</p>}

      <section className="post-list">
        {posts.map((post) => (
          <article className="post-card" key={post.id}>
            <p className="meta">{post.category} · {formatDate(post.publishedAt)}</p>
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
            <div className="tags">
              {post.tags.map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <button onClick={() => openPost(post.slug)}>Read more</button>
          </article>
        ))}
      </section>
    </main>
  );
}

function formatDate(value: string | null): string {
  if (!value) return 'Unpublished';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}

export default App;
