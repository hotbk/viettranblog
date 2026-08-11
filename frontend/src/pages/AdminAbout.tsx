import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import { fetchAdminAbout, updateAbout, UnauthorizedError } from '../api';
import { logout } from '../auth';
import ThemeToggle from '../components/ThemeToggle';

export default function AdminAbout() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleLogout() { logout(); navigate('/admin/login'); }

  useEffect(() => {
    fetchAdminAbout()
      .then((data) => { setTitle(data.title); setContent(data.content); })
      .catch((err) => {
        if (err instanceof UnauthorizedError) { handleLogout(); return; }
        setLoadError(err instanceof Error ? err.message : 'Failed to load About content');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await updateAbout({ title, content });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleLogout(); return; }
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="admin-topbar">
        <div className="admin-topbar__inner">
          <div className="admin-topbar__brand">
            <span className="admin-topbar__brand-name">TECH2BLOGS</span>
            <span className="admin-topbar__brand-sub">Admin Panel</span>
          </div>
          <div className="admin-topbar__actions">
            <ThemeToggle />
            <Link to="/admin/posts" className="admin-topbar__view-site">Posts</Link>
            <Link to="/admin/series" className="admin-topbar__view-site">Series</Link>
            <Link to="/admin/users" className="admin-topbar__view-site">Users</Link>
            <Link to="/admin/books" className="admin-topbar__view-site">Books</Link>
            <Link to="/admin/tools" className="admin-topbar__view-site">Tools</Link>
            <Link to="/" className="admin-topbar__view-site">View site &rarr;</Link>
            <button className="btn--topbar-logout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="admin-posts-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">About Page</h1>
            <p className="admin-page-subtitle">
              Content shown on the public <Link to="/about">/about</Link> page.
            </p>
          </div>
        </div>

        {loading && (
          <div className="spinner-wrap">
            <div className="spinner" />
            <span className="spinner-label">Loading...</span>
          </div>
        )}

        {!loading && loadError && (
          <div className="error-banner">
            <span className="error-banner__text">{loadError}</span>
          </div>
        )}

        {!loading && !loadError && (
          <form onSubmit={handleSave} className="post-form-panel" style={{ maxWidth: 800 }}>
            {saveError && (
              <div className="error-banner" style={{ marginBottom: 16 }}>
                <span className="error-banner__text">{saveError}</span>
              </div>
            )}
            {saved && (
              <div className="comment-form__success" style={{ marginBottom: 16 }}>Saved.</div>
            )}

            <div className="field field--full" style={{ marginBottom: 16 }}>
              <label className="field__label" htmlFor="about-title">Title</label>
              <input
                id="about-title"
                className="field__input"
                type="text"
                value={title}
                placeholder="About this blog"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="field field--full" data-color-mode="light">
              <label className="field__label" htmlFor="about-content">Content</label>
              <MDEditor
                id="about-content"
                value={content}
                onChange={(val) => setContent(val ?? '')}
                height={420}
                textareaProps={{ placeholder: 'Write about this blog... (Markdown supported)' }}
              />
              {!content && (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Left empty, the public page shows "This page is still being written."
                </p>
              )}
            </div>

            <div className="post-form-actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <Link to="/about" className="btn btn--ghost">Preview /about</Link>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
