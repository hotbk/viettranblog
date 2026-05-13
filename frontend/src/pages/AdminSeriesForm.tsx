import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createSeries, updateSeries, fetchAdminSeries, fetchAdminPosts,
  setSeriesPosts, UnauthorizedError,
} from '../api';
import { logout } from '../auth';
import type { SeriesDetail, SeriesPostItem, BlogPost } from '../types';
import type { SeriesRequest } from '../api';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export default function AdminSeriesForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState<SeriesRequest>({
    title: '', slug: '', description: '', status: 'DRAFT',
  });
  const [seriesData, setSeriesData] = useState<SeriesDetail | null>(null);
  const [orderedPostIds, setOrderedPostIds] = useState<number[]>([]);
  const [orderedPosts, setOrderedPosts] = useState<SeriesPostItem[]>([]);
  const [allPosts, setAllPosts] = useState<BlogPost[]>([]);
  const [addPostId, setAddPostId] = useState<string>('');

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEdit);

  useEffect(() => {
    fetchAdminPosts()
      .then(setAllPosts)
      .catch(() => { /* non-critical */ });
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    fetchAdminSeries(Number(id))
      .then((data) => {
        setSeriesData(data);
        setForm({ title: data.title, slug: data.slug, description: data.description ?? '', status: data.status });
        const ids = data.posts.map((p) => p.postId);
        setOrderedPostIds(ids);
        setOrderedPosts(data.posts);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load');
        setLoading(false);
      });
  }, [id, isEdit, navigate]);

  function handleTitleChange(value: string) {
    setForm((f) => ({
      ...f,
      title: value,
      slug: slugManuallyEdited ? f.slug : slugify(value),
    }));
  }

  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true);
    setForm((f) => ({ ...f, slug: value }));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const newIds = [...orderedPostIds];
    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
    setOrderedPostIds(newIds);
    const newPosts = [...orderedPosts];
    [newPosts[index - 1], newPosts[index]] = [newPosts[index], newPosts[index - 1]];
    newPosts[index - 1] = { ...newPosts[index - 1], position: index };
    newPosts[index] = { ...newPosts[index], position: index + 1 };
    setOrderedPosts(newPosts);
  }

  function moveDown(index: number) {
    if (index === orderedPostIds.length - 1) return;
    const newIds = [...orderedPostIds];
    [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
    setOrderedPostIds(newIds);
    const newPosts = [...orderedPosts];
    [newPosts[index], newPosts[index + 1]] = [newPosts[index + 1], newPosts[index]];
    newPosts[index] = { ...newPosts[index], position: index + 1 };
    newPosts[index + 1] = { ...newPosts[index + 1], position: index + 2 };
    setOrderedPosts(newPosts);
  }

  function removePost(index: number) {
    const newIds = orderedPostIds.filter((_, i) => i !== index);
    setOrderedPostIds(newIds);
    setOrderedPosts(orderedPosts.filter((_, i) => i !== index).map((p, i) => ({ ...p, position: i + 1 })));
  }

  function addPost() {
    const postId = Number(addPostId);
    if (!postId || orderedPostIds.includes(postId)) return;
    const post = allPosts.find((p) => p.id === postId);
    if (!post) return;
    const newPos = orderedPosts.length + 1;
    setOrderedPostIds([...orderedPostIds, postId]);
    setOrderedPosts([...orderedPosts, {
      position: newPos, postId: post.id, title: post.title,
      slug: post.slug, excerpt: post.excerpt, status: post.status, publishedAt: post.publishedAt,
    }]);
    setAddPostId('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.slug.trim()) {
      setError('Title and slug are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let result: SeriesDetail;
      if (isEdit) {
        result = await updateSeries(Number(id), form);
        await setSeriesPosts(result.id, orderedPostIds);
      } else {
        result = await createSeries(form);
        if (orderedPostIds.length > 0) {
          await setSeriesPosts(result.id, orderedPostIds);
        }
      }
      navigate('/admin/series');
    } catch (err) {
      if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const availablePosts = allPosts.filter((p) => !orderedPostIds.includes(p.id));

  if (loading) {
    return (
      <div className="spinner-wrap" style={{ marginTop: 120 }}>
        <div className="spinner" /><span className="spinner-label">Loading...</span>
      </div>
    );
  }

  return (
    <>
      <header className="admin-topbar">
        <div className="admin-topbar__inner">
          <div className="admin-topbar__brand">
            <span className="admin-topbar__brand-name">viettran Blog</span>
            <span className="admin-topbar__brand-sub">Admin Panel</span>
          </div>
          <div className="admin-topbar__actions">
            <Link to="/admin/posts" className="admin-topbar__view-site">Posts</Link>
            <Link to="/admin/exams" className="admin-topbar__view-site">Exams</Link>
            <Link to="/admin/attempts" className="admin-topbar__view-site">Attempts</Link>
            <Link to="/admin/series" className="admin-topbar__view-site">← Series</Link>
            <Link to="/" className="admin-topbar__view-site">View site &rarr;</Link>
            <button className="btn--topbar-logout" onClick={() => { logout(); navigate('/admin/login'); }}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="admin-posts-page">
        <div className="admin-page-header">
          <h1 className="admin-page-title">{isEdit ? `Edit: ${seriesData?.title}` : 'Create New Series'}</h1>
        </div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 20 }}>
            <span className="error-banner__text">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="admin-series-form">
          <div className="form-group">
            <label className="form-label" htmlFor="sf-title">
              Title <span className="form-required">*</span>
            </label>
            <input
              id="sf-title"
              className="form-input"
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Learning React from Scratch"
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sf-slug">
              Slug <span className="form-required">*</span>
            </label>
            <input
              id="sf-slug"
              className="form-input"
              value={form.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="learning-react-from-scratch"
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sf-desc">Description</label>
            <textarea
              id="sf-desc"
              className="form-input form-textarea"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief introduction to this series..."
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sf-status">Status</label>
            <select
              id="sf-status"
              className="form-input"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'DRAFT' | 'PUBLISHED' }))}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </div>

          {/* Post ordering section */}
          <div className="series-posts-section">
            <h2 className="series-posts-section__title">Posts in series ({orderedPosts.length})</h2>

            {orderedPosts.length > 0 && (
              <ol className="series-edit-list">
                {orderedPosts.map((item, index) => (
                  <li key={item.postId} className="series-edit-item">
                    <span className="series-edit-item__num">{item.position}</span>
                    <span className="series-edit-item__title">{item.title}</span>
                    <div className="series-edit-item__actions">
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveUp(index)} disabled={index === 0} title="Move up">↑</button>
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => moveDown(index)} disabled={index === orderedPosts.length - 1} title="Move down">↓</button>
                      <button type="button" className="btn btn--sm btn--danger" onClick={() => removePost(index)} title="Remove from series">✕</button>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {availablePosts.length > 0 && (
              <div className="series-add-post">
                <select
                  className="form-input"
                  value={addPostId}
                  onChange={(e) => setAddPostId(e.target.value)}
                >
                  <option value="">— Select a post to add —</option>
                  {availablePosts.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.status}] {p.title}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn--ghost" onClick={addPost} disabled={!addPostId}>
                  Add post
                </button>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create series'}
            </button>
            <Link to="/admin/series" className="btn btn--ghost">Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}
