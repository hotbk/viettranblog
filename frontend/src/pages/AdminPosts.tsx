import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchAdminPosts, deletePost, UnauthorizedError } from '../api';
import { logout } from '../auth';
import type { BlogPost } from '../types';
import PostForm from './PostForm';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d);
}

type PanelMode = 'none' | 'create' | { post: BlogPost };

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastId = 0;

export default function AdminPosts() {
  const navigate = useNavigate();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelMode>('none');
  const [refreshKey, setRefreshKey] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFetchError(null);
      setDeleteError(null);
      try {
        const data = await fetchAdminPosts();
        if (!cancelled) setPosts(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) {
          logout();
          navigate('/admin/login');
          return;
        }
        setFetchError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshKey, navigate]);

  function showToast(message: string, type: 'success' | 'error') {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }

  function loadPosts() {
    setRefreshKey((k) => k + 1);
  }

  function handleLogout() {
    logout();
    navigate('/admin/login');
  }

  async function handleDelete(post: BlogPost) {
    const confirmed = window.confirm(`Delete "${post.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleteError(null);
    // Optimistic remove
    setPosts((prev) => prev.filter((p) => p.id !== post.id));

    try {
      await deletePost(post.id);
      showToast(`"${post.title}" deleted.`, 'success');
    } catch (err) {
      // Rollback
      setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
      if (err instanceof UnauthorizedError) {
        logout();
        navigate('/admin/login');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to delete post';
      setDeleteError(msg);
      showToast(msg, 'error');
    }
  }

  function handleSaved(saved: BlogPost) {
    setPanel('none');
    setPosts((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      return exists
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [saved, ...prev];
    });
    showToast(`"${saved.title}" saved successfully.`, 'success');
  }

  function handleCancel() {
    setPanel('none');
  }

  const showForm = panel !== 'none';
  const formInitial = typeof panel === 'object' && 'post' in panel ? panel.post : undefined;

  return (
    <>
      {/* ── Admin Topbar ──────────────────────── */}
      <header className="admin-topbar">
        <div className="admin-topbar__inner">
          <div className="admin-topbar__brand">
            <span className="admin-topbar__brand-name">viettran Blog</span>
            <span className="admin-topbar__brand-sub">Admin Panel</span>
          </div>
          <div className="admin-topbar__actions">
            <Link to="/admin/users" className="admin-topbar__view-site">Users</Link>
            <Link to="/" className="admin-topbar__view-site">View site &rarr;</Link>
            <button className="btn--topbar-logout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ──────────────────────── */}
      <div className="admin-posts-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Posts</h1>
            <p className="admin-page-subtitle">
              {loading ? 'Loading...' : `${posts.length} post${posts.length !== 1 ? 's' : ''} total`}
            </p>
          </div>
          <button
            className="btn btn--accent"
            onClick={() => setPanel('create')}
            disabled={showForm}
          >
            + New Post
          </button>
        </div>

        {/* Inline form */}
        {showForm && (
          <PostForm
            initial={formInitial}
            existingSlugs={posts.map((p) => p.slug)}
            onSave={handleSaved}
            onCancel={handleCancel}
          />
        )}

        {/* Delete error */}
        {deleteError && (
          <div className="error-banner" style={{ marginBottom: 20 }}>
            <span className="error-banner__text">{deleteError}</span>
            <button className="error-banner__retry" onClick={() => setDeleteError(null)}>Dismiss</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="spinner-wrap">
            <div className="spinner" />
            <span className="spinner-label">Loading posts...</span>
          </div>
        )}

        {/* Fetch error */}
        {!loading && fetchError && (
          <div className="error-banner">
            <span className="error-banner__text">{fetchError}</span>
            <button className="error-banner__retry" onClick={loadPosts}>Retry</button>
          </div>
        )}

        {/* Empty */}
        {!loading && !fetchError && posts.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">&#9997;</div>
            <p className="empty-state__title">No posts yet</p>
            <p className="empty-state__desc">
              Create your first post to get started.
            </p>
            <button
              className="btn btn--accent"
              onClick={() => setPanel('create')}
              style={{ marginTop: 16 }}
            >
              + New Post
            </button>
          </div>
        )}

        {/* Posts table */}
        {!loading && !fetchError && posts.length > 0 && (
          <div className="posts-table-wrap">
            <table className="posts-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Published</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div className="post-title-cell__title">{post.title}</div>
                      <div className="post-title-cell__slug">{post.slug}</div>
                    </td>
                    <td>{post.category || <span style={{ color: 'var(--color-text-light)' }}>—</span>}</td>
                    <td>
                      <StatusBadge status={post.status} />
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                      {formatDate(post.publishedAt)}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => setPanel({ post })}
                          disabled={showForm}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn--danger-ghost btn--sm"
                          onClick={() => handleDelete(post)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Toast notifications ────────────────── */}
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </>
  );
}

function StatusBadge({ status }: { status: 'DRAFT' | 'PUBLISHED' }) {
  return (
    <span className={`badge ${status === 'PUBLISHED' ? 'badge--published' : 'badge--draft'}`}>
      {status}
    </span>
  );
}
