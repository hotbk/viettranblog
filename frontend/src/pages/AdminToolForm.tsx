import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createTool, updateTool, fetchAdminTool, UnauthorizedError } from '../api';
import { logout } from '../auth';
import ThemeToggle from '../components/ThemeToggle';
import type { AdminTool, ToolStatus, ToolVisibility } from '../types';

const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_COVER_SIZE = 2 * 1024 * 1024;
// Mirrors ToolService.MAX_HTML_SOURCE_SIZE — checked client-side too so a
// paste that's too big fails instantly instead of after a round trip.
const MAX_HTML_SOURCE_SIZE = 1024 * 1024;

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function AdminToolForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [initial, setInitial] = useState<AdminTool | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [htmlSource, setHtmlSource] = useState('');
  const [status, setStatus] = useState<ToolStatus>('DRAFT');
  const [visibility, setVisibility] = useState<ToolVisibility>('PUBLIC');

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAuthError() { logout(); navigate('/admin/login'); }

  useEffect(() => {
    if (!isEditMode || !id) return;
    fetchAdminTool(Number(id))
      .then((tool) => {
        setInitial(tool);
        setTitle(tool.title);
        setSlug(tool.slug);
        setSlugTouched(true);
        setCategory(tool.category ?? '');
        setTags(tool.tags.join(', '));
        setExcerpt(tool.excerpt ?? '');
        setHtmlSource(tool.htmlSource);
        setStatus(tool.status);
        setVisibility(tool.visibility);
      })
      .catch((err) => {
        if (err instanceof UnauthorizedError) { handleAuthError(); return; }
        setLoadError(err instanceof Error ? err.message : 'Failed to load tool');
      })
      .finally(() => setLoadingInitial(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    return () => { if (coverPreview) URL.revokeObjectURL(coverPreview); };
  }, [coverPreview]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverError(null);
    if (!ALLOWED_COVER_TYPES.includes(file.type)) {
      setCoverError('Only JPEG, PNG, and WebP images are accepted.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_COVER_SIZE) {
      setCoverError('Cover image must be 2 MB or smaller.');
      e.target.value = '';
      return;
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setRemoveCover(false);
  }

  // Client-only preview: renders whatever is currently in the textarea, in the
  // same sandbox="allow-scripts" (no allow-same-origin) as the real public
  // page, without saving anything — lets an admin sanity-check a paste before
  // publishing it.
  function handlePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!htmlSource.trim()) { setPreviewUrl(null); return; }
    const blob = new Blob([htmlSource], { type: 'text/html' });
    setPreviewUrl(URL.createObjectURL(blob));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!slug.trim()) {
      setError('Slug is required.');
      return;
    }
    if (!isEditMode && !htmlSource.trim()) {
      setError('HTML source is required.');
      return;
    }
    if (htmlSource.length > MAX_HTML_SOURCE_SIZE) {
      setError('HTML source exceeds the 1 MB limit.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title, slug: slug.trim(), category: category.trim(), excerpt: excerpt.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        htmlSource, status, visibility,
      };

      if (isEditMode && initial) {
        await updateTool(initial.id, payload, coverFile ?? undefined, removeCover);
      } else {
        await createTool(payload, coverFile ?? undefined);
      }
      navigate('/admin/tools');
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleAuthError(); return; }
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingInitial) {
    return (
      <div className="admin-posts-page">
        <div className="spinner-wrap"><div className="spinner" /><span className="spinner-label">Loading...</span></div>
      </div>
    );
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
            <Link to="/admin/tools" className="admin-topbar__view-site">&larr; Tools</Link>
            <Link to="/" className="admin-topbar__view-site">View site &rarr;</Link>
          </div>
        </div>
      </header>

      <div className="admin-posts-page">
        <div className="post-form-panel">
          <div className="post-form-panel__header">
            <h2 className="post-form-panel__title">{isEditMode ? 'Edit Tool' : 'New Tool'}</h2>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/admin/tools')}>
              Cancel
            </button>
          </div>

          {(error || loadError) && (
            <div className="error-banner" style={{ marginBottom: 24 }}>
              <span className="error-banner__text">{error ?? loadError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="post-form-grid">
              <div className="field field--full">
                <label className="field__label field__label--required" htmlFor="tf-title">Title</label>
                <input
                  id="tf-title" className="field__input" type="text" required value={title}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTitle(next);
                    if (!slugTouched) setSlug(slugify(next));
                  }}
                  placeholder="Tool title"
                />
              </div>

              <div className="field">
                <label className="field__label field__label--required" htmlFor="tf-slug">Slug</label>
                <input
                  id="tf-slug" className="field__input" type="text" required value={slug}
                  onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
                  placeholder="tool-url-slug"
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="tf-category">Category</label>
                <input
                  id="tf-category" className="field__input" type="text" value={category}
                  onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Database"
                />
              </div>

              <div className="field field--full">
                <label className="field__label" htmlFor="tf-tags">Tags</label>
                <input
                  id="tf-tags" className="field__input" type="text" value={tags}
                  onChange={(e) => setTags(e.target.value)} placeholder="comma, separated, tags"
                />
              </div>

              <div className="field field--full">
                <label className="field__label" htmlFor="tf-excerpt">Excerpt</label>
                <textarea
                  id="tf-excerpt" className="field__textarea" rows={2} value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Short description shown on the tools listing page..."
                />
              </div>

              {/* HTML source */}
              <div className="field field--full">
                <label className="field__label field__label--required" htmlFor="tf-html">HTML Source</label>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                  Paste a complete, self-contained HTML page (CSS/JS inline or via CDN links —
                  no other files can be attached). Stored and served exactly as pasted, max 1 MB.
                  {isEditMode && ' Leave blank to keep the current source unchanged.'}
                </p>
                <textarea
                  id="tf-html" className="field__textarea tool-form__html-source" rows={16}
                  value={htmlSource} onChange={(e) => setHtmlSource(e.target.value)}
                  placeholder={isEditMode ? '(unchanged)' : '<!doctype html>\n<html>\n  ...\n</html>'}
                  spellCheck={false}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={handlePreview}>
                    Preview
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {htmlSource.length.toLocaleString()} / {MAX_HTML_SOURCE_SIZE.toLocaleString()} characters
                  </span>
                </div>
                {previewUrl && (
                  <iframe
                    src={previewUrl}
                    title="Preview"
                    className="tool-form__preview-frame"
                    sandbox="allow-scripts"
                  />
                )}
              </div>

              {/* Cover image */}
              <div className="field field--full">
                <label className="field__label">Cover Image</label>
                <div className="cover-image-upload">
                  {isEditMode && initial?.hasCoverImage && initial.coverImageUrl && !removeCover && !coverPreview && (
                    <div style={{ marginBottom: 12 }}>
                      <img src={initial.coverImageUrl} alt="Current cover" className="cover-image-preview" />
                    </div>
                  )}
                  {coverPreview && (
                    <div style={{ marginBottom: 12 }}>
                      <img src={coverPreview} alt="Cover preview" className="cover-image-preview" />
                    </div>
                  )}
                  <input
                    ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }} onChange={handleCoverChange}
                  />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => coverInputRef.current?.click()}>
                      {coverPreview || (isEditMode && initial?.hasCoverImage && !removeCover) ? 'Replace image' : 'Choose image'}
                    </button>
                    {(coverPreview || (isEditMode && initial?.hasCoverImage && !removeCover)) && (
                      <button
                        type="button" className="btn btn--sm cover-image-remove-btn"
                        onClick={() => {
                          if (coverPreview) { URL.revokeObjectURL(coverPreview); setCoverPreview(null); }
                          setCoverFile(null);
                          setRemoveCover(true);
                          if (coverInputRef.current) coverInputRef.current.value = '';
                        }}
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                  {coverError && <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-error)' }}>{coverError}</p>}
                  <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>JPEG, PNG, or WebP — max 2 MB</p>
                </div>
              </div>

              {/* Status */}
              <div className="field">
                <label className="field__label">Status</label>
                <div className="status-toggle">
                  <button type="button" className={`status-toggle__option${status === 'DRAFT' ? ' status-toggle__option--active-draft' : ''}`} onClick={() => setStatus('DRAFT')}>Draft</button>
                  <button type="button" className={`status-toggle__option${status === 'PUBLISHED' ? ' status-toggle__option--active-published' : ''}`} onClick={() => setStatus('PUBLISHED')}>Published</button>
                </div>
              </div>

              {/* Visibility */}
              <div className="field">
                <label className="field__label">Visibility</label>
                <div className="status-toggle">
                  <button type="button" className={`status-toggle__option${visibility === 'PUBLIC' ? ' status-toggle__option--active-published' : ''}`} onClick={() => setVisibility('PUBLIC')}>Public</button>
                  <button type="button" className={`status-toggle__option${visibility === 'PRIVATE' ? ' status-toggle__option--active-draft' : ''}`} onClick={() => setVisibility('PRIVATE')}>🔒 Private</button>
                </div>
                <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Private tools are hidden from the public listing and raw endpoint entirely —
                  there is no per-group sharing for tools (unlike posts/books).
                </p>
              </div>
            </div>

            <div className="post-form-actions">
              <button type="submit" disabled={submitting} className="btn btn--primary">
                {submitting ? 'Saving...' : isEditMode ? 'Save changes' : 'Create tool'}
              </button>
              <button type="button" onClick={() => navigate('/admin/tools')} disabled={submitting} className="btn btn--ghost">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
