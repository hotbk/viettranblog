import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { createPost, updatePost, uploadContentImage, UnauthorizedError } from '../api';
import { logout } from '../auth';
import ImageUploadButton from '../components/ImageUploadButton';
import { alignCommands } from '../components/editorCommands';
import type { BlogPost } from '../types';

const SQL_RE = /^(select|insert|update|delete|create|drop|alter|with|truncate|explain|grant|revoke|from|where)\s/i;
const BASH_RE = /^(sudo|apt(-get)?|yum|dnf|brew|npm|yarn|pnpm|git|docker|kubectl|helm|curl|wget|ls|cd|mkdir|rmdir|rm|cp|mv|chmod|chown|grep|find|ps|kill|systemctl|service|cat|echo|export|source|python|pip|java|mvn|gradle)\s/i;

function detectCodeLanguage(text: string): string | null {
  const first = text.trimStart().split('\n')[0].trim();
  if (SQL_RE.test(first)) return 'sql';
  if (first.startsWith('#!') || first.startsWith('$ ') || BASH_RE.test(first)) return 'bash';
  return null;
}

function wrapAsCodeBlock(pasted: string, currentContent: string, pos: number): string | null {
  // Skip if already inside a code fence
  const before = currentContent.slice(0, pos);
  const openFences = (before.match(/```/g) ?? []).length;
  if (openFences % 2 !== 0) return null;

  const lang = detectCodeLanguage(pasted);
  if (!lang) return null;
  return `\`\`\`${lang}\n${pasted.trim()}\n\`\`\``;
}

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

  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

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

  const previewCoverSrc =
    coverImagePreview ??
    (isEditMode && initial?.hasCoverImage && !removeCoverImage ? initial.coverImageUrl : null);

  const previewTags = tags.split(',').map((t) => t.trim()).filter(Boolean);

  return (
    <div className="post-form-panel">
      <div className="post-form-panel__header">
        <h2 className="post-form-panel__title">
          {isEditMode ? 'Edit Post' : 'New Post'}
        </h2>
        <div className="post-form-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'edit'}
            className={`post-form-tab${mode === 'edit' ? ' post-form-tab--active' : ''}`}
            onClick={() => setMode('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'preview'}
            className={`post-form-tab${mode === 'preview' ? ' post-form-tab--active' : ''}`}
            onClick={() => setMode('preview')}
          >
            Preview
          </button>
        </div>
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

      {/* ── Preview pane ───────────────────────── */}
      {mode === 'preview' && (
        <div className="post-preview-pane">
          <p className="post-preview-notice">
            Preview — this is how your post will appear to readers
          </p>

          {previewCoverSrc && (
            <img src={previewCoverSrc} alt={title} className="post-detail__cover" />
          )}

          <div className="post-detail__category-row">
            {category && <span className="post-detail__category">{category}</span>}
            <span className="post-detail__date">
              {status === 'PUBLISHED'
                ? new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date())
                : 'Draft'}
            </span>
          </div>

          <h1 className="post-detail__title">{title || 'Untitled'}</h1>

          {excerpt && (
            <p className="post-preview-excerpt">{excerpt}</p>
          )}

          {previewTags.length > 0 && (
            <div className="post-detail__tags">
              {previewTags.map((tag) => (
                <span key={tag} className="post-detail__tag">#{tag}</span>
              ))}
            </div>
          )}

          <div className="post-detail__divider" />

          <div className="post-detail__content" data-color-mode="light">
            <ReactMarkdown
              rehypePlugins={[rehypeRaw]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className ?? '');
                  if (!match) {
                    return <code className="inline-code" {...props}>{children}</code>;
                  }
                  return (
                    <SyntaxHighlighter
                      style={oneLight}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{ borderRadius: 8, fontSize: 14, margin: '1em 0' }}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  );
                },
              }}
            >
              {content || '*No content yet...*'}
            </ReactMarkdown>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: mode === 'preview' ? 'none' : undefined }}>
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
          <div className="field field--full" data-color-mode="light">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="field__label field__label--required" htmlFor="pf-content" style={{ margin: 0 }}>
                Content
              </label>
              <ImageUploadButton
                onInsert={(snippet) => setContent((prev) => prev + (prev.endsWith('\n') || !prev ? '' : '\n') + '\n' + snippet + '\n')}
                onAuthError={() => { logout(); navigate('/admin/login'); }}
              />
            </div>
            <MDEditor
              id="pf-content"
              value={content}
              onChange={(val) => setContent(val ?? '')}
              height={420}
              extraCommands={alignCommands}
              textareaProps={{
                placeholder: 'Write your post content here... (paste SQL or shell commands to auto-format)',
                onPaste(e) {
                  // Image paste: detect image/* in clipboard items
                  const imgItem = Array.from(e.clipboardData.items)
                    .find((it) => it.type.startsWith('image/'));
                  if (imgItem) {
                    const file = imgItem.getAsFile();
                    if (file) {
                      e.preventDefault();
                      const ta = e.currentTarget;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      uploadContentImage(file)
                        .then(({ url }) => {
                          const snippet = `![pasted-image](${url})`;
                          setContent((prev) => {
                            const before = prev.slice(0, start);
                            const after = prev.slice(end);
                            const sep = before && !before.endsWith('\n') ? '\n\n' : '';
                            return before + sep + snippet + '\n' + after;
                          });
                        })
                        .catch((err) => {
                          if (err instanceof UnauthorizedError) { logout(); navigate('/admin/login'); }
                        });
                      return;
                    }
                  }
                  // Code block auto-wrap on text paste
                  const pasted = e.clipboardData.getData('text');
                  if (!pasted.trim()) return;
                  const ta = e.currentTarget;
                  const wrapped = wrapAsCodeBlock(pasted, content, ta.selectionStart);
                  if (!wrapped) return;
                  e.preventDefault();
                  const before = content.slice(0, ta.selectionStart);
                  const after = content.slice(ta.selectionEnd);
                  const sep = before && !before.endsWith('\n') ? '\n\n' : '';
                  setContent(before + sep + wrapped + (after.startsWith('\n') ? after : '\n' + after));
                },
              }}
            />
            {!content && (
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                SQL and shell commands are automatically wrapped in code blocks on paste.
              </p>
            )}
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
