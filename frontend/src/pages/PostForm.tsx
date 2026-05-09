import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPost, updatePost, UnauthorizedError } from '../api';
import { logout } from '../auth';
import type { BlogPost } from '../types';

interface PostFormProps {
  initial?: BlogPost;
  existingSlugs?: string[];
  onSave: (post: BlogPost) => void;
  onCancel: () => void;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export default function PostForm({ initial, existingSlugs, onSave, onCancel }: PostFormProps) {
  const navigate = useNavigate();
  const isEditMode = Boolean(initial);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(isEditMode);
  const [category, setCategory] = useState(initial?.category ?? '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [tags, setTags] = useState<string>((initial?.tags ?? []).join(', '));
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>(initial?.status ?? 'DRAFT');

  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [coverImageError, setCoverImageError] = useState<string | null>(null);
  const [removeCoverImage, setRemoveCoverImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (coverImagePreview) URL.revokeObjectURL(coverImagePreview);
    };
  }, [coverImagePreview]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const tagsArray = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const trimmedSlug = slug.trim();
    const ownSlug = initial?.slug ?? '';
    const otherSlugs = (existingSlugs ?? []).filter((s) => s !== ownSlug);
    if (otherSlugs.includes(trimmedSlug)) {
      setError('Slug already exists — choose a different one.');
      setSubmitting(false);
      return;
    }

    const payload = { title, slug: trimmedSlug, category, excerpt, content, tags: tagsArray, status };

    try {
      let saved: BlogPost;
      if (isEditMode && initial) {
        saved = await updatePost(initial.id, payload, coverImageFile ?? undefined, removeCoverImage);
      } else {
        saved = await createPost(payload, coverImageFile ?? undefined);
      }
      onSave(saved);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        logout();
        navigate('/admin/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="post-form-panel">
      <div className="post-form-panel__header">
        <h2 className="post-form-panel__title">
          {isEditMode ? 'Edit Post' : 'New Post'}
        </h2>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 24 }}>
          <span className="error-banner__text">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="post-form-grid">
          {/* Title */}
          <div className="field field--full">
            <label className="field__label field__label--required" htmlFor="pf-title">
              Title
            </label>
            <input
              id="pf-title"
              className="field__input"
              type="text"
              required
              value={title}
              placeholder="Post title"
              onChange={(e) => {
                const next = e.target.value;
                setTitle(next);
                if (!slugTouched) setSlug(slugify(next));
              }}
            />
          </div>

          {/* Slug */}
          <div className="field">
            <label className="field__label field__label--required" htmlFor="pf-slug">
              Slug
            </label>
            <input
              id="pf-slug"
              className="field__input"
              type="text"
              required
              value={slug}
              placeholder="post-url-slug"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </div>

          {/* Category */}
          <div className="field">
            <label className="field__label" htmlFor="pf-category">
              Category
            </label>
            <input
              id="pf-category"
              className="field__input"
              type="text"
              value={category}
              placeholder="e.g. Technology"
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          {/* Excerpt */}
          <div className="field field--full">
            <label className="field__label" htmlFor="pf-excerpt">
              Excerpt
            </label>
            <textarea
              id="pf-excerpt"
              className="field__textarea"
              rows={3}
              value={excerpt}
              placeholder="Short summary displayed in post cards..."
              onChange={(e) => setExcerpt(e.target.value)}
            />
          </div>

          {/* Content */}
          <div className="field field--full">
            <label className="field__label field__label--required" htmlFor="pf-content">
              Content
            </label>
            <textarea
              id="pf-content"
              className="field__textarea"
              rows={10}
              required
              value={content}
              placeholder="Write your post content here..."
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="field">
            <label className="field__label" htmlFor="pf-tags">
              Tags <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(comma-separated)</span>
            </label>
            <input
              id="pf-tags"
              className="field__input"
              type="text"
              value={tags}
              placeholder="react, typescript, vite"
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {/* Status */}
          <div className="field">
            <label className="field__label">Status</label>
            <div className="status-toggle">
              <button
                type="button"
                className={`status-toggle__option${status === 'DRAFT' ? ' status-toggle__option--active-draft' : ''}`}
                onClick={() => setStatus('DRAFT')}
              >
                Draft
              </button>
              <button
                type="button"
                className={`status-toggle__option${status === 'PUBLISHED' ? ' status-toggle__option--active-published' : ''}`}
                onClick={() => setStatus('PUBLISHED')}
              >
                Published
              </button>
            </div>
          </div>

          {/* Cover Image */}
          <div className="field field--full">
            <label className="field__label">Cover Image</label>
            <div className="cover-image-upload">
              {/* Existing image (edit mode, not yet removed) */}
              {isEditMode && initial?.hasCoverImage && initial.coverImageUrl && !removeCoverImage && !coverImagePreview && (
                <div style={{ marginBottom: 12 }}>
                  <img
                    src={initial.coverImageUrl}
                    alt="Current cover"
                    className="cover-image-preview"
                  />
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                    Current image: {initial.coverImageOriginalFilename ?? 'cover'}
                  </p>
                </div>
              )}

              {/* New file preview */}
              {coverImagePreview && (
                <div style={{ marginBottom: 12 }}>
                  <img
                    src={coverImagePreview}
                    alt="Cover preview"
                    className="cover-image-preview"
                  />
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
                    {coverImageFile?.name}
                  </p>
                </div>
              )}

              {/* File input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  setCoverImageError(null);
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                    setCoverImageError('Only JPEG, PNG, and WebP images are accepted.');
                    e.target.value = '';
                    return;
                  }
                  if (file.size > 2 * 1024 * 1024) {
                    setCoverImageError('Image must be 2 MB or smaller.');
                    e.target.value = '';
                    return;
                  }
                  // Revoke previous preview URL before creating a new one
                  if (coverImagePreview) URL.revokeObjectURL(coverImagePreview);
                  setCoverImageFile(file);
                  setCoverImagePreview(URL.createObjectURL(file));
                  setRemoveCoverImage(false);
                }}
              />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {coverImagePreview || (isEditMode && initial?.hasCoverImage && !removeCoverImage)
                    ? 'Replace image'
                    : 'Choose image'}
                </button>

                {/* Remove button — show when there's something to remove */}
                {(coverImagePreview || (isEditMode && initial?.hasCoverImage && !removeCoverImage)) && (
                  <button
                    type="button"
                    className="btn btn--sm cover-image-remove-btn"
                    onClick={() => {
                      if (coverImagePreview) {
                        URL.revokeObjectURL(coverImagePreview);
                        setCoverImagePreview(null);
                      }
                      setCoverImageFile(null);
                      setRemoveCoverImage(true);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Remove image
                  </button>
                )}
              </div>

              {coverImageError && (
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-error)' }}>
                  {coverImageError}
                </p>
              )}

              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
                JPEG, PNG, or WebP — max 2 MB
              </p>
            </div>
          </div>
        </div>

        <div className="post-form-actions">
          <button
            type="submit"
            disabled={submitting}
            className="btn btn--primary"
          >
            {submitting ? 'Saving...' : isEditMode ? 'Save changes' : 'Create post'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn btn--ghost"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
