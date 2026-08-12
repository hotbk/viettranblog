import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createBook, updateBook, fetchAdminBookById, UnauthorizedError,
  fetchAccessGroups, fetchAdminUsers, fetchBookAccessGroups, fetchBookAccessUsers,
  setBookAccessGroups as apiSetBookAccessGroups, setBookAccessUsers as apiSetBookAccessUsers,
  linkBookTranslation, markBookTranslationReviewed,
} from '../api';
import { logout } from '../auth';
import AdminTopbar from '../components/AdminTopbar';
import TranslationsPanel from '../components/TranslationsPanel';
import type { Book, BookFileType, BookVisibility, AccessGroup, UserBrief, ContentLanguage } from '../types';
import { slugify } from '../slugify';

const ALLOWED_BOOK_TYPES: Record<string, BookFileType> = {
  'application/pdf': 'PDF',
  'text/plain': 'TXT',
};
// .sh/.sql have no standardized browser-assigned MIME type (varies by OS/
// browser — often '' or application/octet-stream), so unlike the map above
// they're recognized by extension. The backend re-validates by content
// regardless (see BookService.applyFile) — this is a client-side UX check only.
const ALLOWED_BOOK_EXTENSIONS: Record<string, BookFileType> = {
  md: 'MD',
  sh: 'SH',
  sql: 'SQL',
  docx: 'DOCX',
};
const MAX_BOOK_SIZE = 50 * 1024 * 1024;
const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_COVER_SIZE = 2 * 1024 * 1024;

export default function AdminBookForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [initial, setInitial] = useState<Book | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(isEditMode);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [visibility, setVisibility] = useState<BookVisibility>('PUBLIC');
  const [metadataVisibility, setMetadataVisibility] = useState<'PUBLIC_METADATA' | 'AUTHORIZED_ONLY'>('PUBLIC_METADATA');
  const [downloadable, setDownloadable] = useState(true);
  const [language, setLanguage] = useState<ContentLanguage>('VI');

  const [bookFile, setBookFile] = useState<File | null>(null);
  const [bookFileError, setBookFileError] = useState<string | null>(null);
  const bookFileInputRef = useRef<HTMLInputElement>(null);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [availableGroups, setAvailableGroups] = useState<AccessGroup[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserBrief[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAuthError() { logout(); navigate('/admin/login'); }

  useEffect(() => {
    if (!isEditMode || !id) return;
    fetchAdminBookById(Number(id))
      .then((book) => {
        setInitial(book);
        setTitle(book.title);
        setSlug(book.slug);
        setSlugTouched(true);
        setAuthor(book.author ?? '');
        setDescription(book.description ?? '');
        setCategory(book.category ?? '');
        setStatus(book.status);
        setVisibility(book.visibility);
        setMetadataVisibility(book.metadataVisibility ?? 'PUBLIC_METADATA');
        setDownloadable(book.downloadable);
        setLanguage(book.language);
      })
      .catch((err) => {
        if (err instanceof UnauthorizedError) { handleAuthError(); return; }
        setLoadError(err instanceof Error ? err.message : 'Failed to load book');
      })
      .finally(() => setLoadingInitial(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (visibility !== 'PRIVATE') return;
    fetchAccessGroups().then(setAvailableGroups).catch(() => setAvailableGroups([]));
    fetchAdminUsers().then((users) =>
      setAvailableUsers(users.map((u) => ({ id: u.id, username: u.username, email: u.email })))
    ).catch(() => setAvailableUsers([]));
  }, [visibility]);

  useEffect(() => {
    if (!isEditMode || !id) return;
    fetchBookAccessGroups(Number(id)).then((groups) => setSelectedGroupIds(groups.map((g) => g.id))).catch(() => {});
    fetchBookAccessUsers(Number(id)).then((users) => setSelectedUserIds(users.map((u) => u.id))).catch(() => {});
  }, [id, isEditMode]);

  useEffect(() => {
    return () => { if (coverPreview) URL.revokeObjectURL(coverPreview); };
  }, [coverPreview]);

  function handleBookFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBookFileError(null);
    const extension = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
    if (!(file.type in ALLOWED_BOOK_TYPES) && !(extension in ALLOWED_BOOK_EXTENSIONS)) {
      setBookFileError('Only PDF, TXT, MD, SH, SQL, or DOCX files are accepted.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_BOOK_SIZE) {
      setBookFileError('File must be 50 MB or smaller.');
      e.target.value = '';
      return;
    }
    setBookFile(file);
  }

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
    if (!isEditMode && !bookFile) {
      setError('A book file (PDF, TXT, MD, SH, SQL, or DOCX) is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title, slug: slug.trim(), author: author.trim() || undefined,
        description: description.trim() || undefined, category: category.trim() || undefined,
        status, visibility, metadataVisibility, downloadable, language,
      };

      let saved: Book;
      if (isEditMode && initial) {
        saved = await updateBook(initial.id, payload, bookFile ?? undefined, coverFile ?? undefined, removeCover);
      } else {
        saved = await createBook(payload, bookFile!, coverFile ?? undefined);
      }

      const groupIds = visibility === 'PRIVATE' ? selectedGroupIds : [];
      const userIds = visibility === 'PRIVATE' ? selectedUserIds : [];
      await Promise.all([
        apiSetBookAccessGroups(saved.id, groupIds),
        apiSetBookAccessUsers(saved.id, userIds),
      ]);

      navigate('/admin/books');
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
      <AdminTopbar back={{ to: '/admin/books', label: '← Books' }} />

      <div className="admin-posts-page">
        <div className="post-form-panel">
          <div className="post-form-panel__header">
            <h2 className="post-form-panel__title">{isEditMode ? 'Edit Book' : 'New Book'}</h2>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/admin/books')}>
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
                <label className="field__label field__label--required" htmlFor="bf-title">Title</label>
                <input
                  id="bf-title" className="field__input" type="text" required value={title}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTitle(next);
                    if (!slugTouched) setSlug(slugify(next));
                  }}
                  placeholder="Book title"
                />
              </div>

              <div className="field">
                <label className="field__label field__label--required" htmlFor="bf-slug">Slug</label>
                <input
                  id="bf-slug" className="field__input" type="text" required value={slug}
                  onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
                  placeholder="book-url-slug"
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="bf-author">Author</label>
                <input
                  id="bf-author" className="field__input" type="text" value={author}
                  onChange={(e) => setAuthor(e.target.value)} placeholder="Book's author"
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="bf-category">Category</label>
                <input
                  id="bf-category" className="field__input" type="text" value={category}
                  onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Database"
                />
              </div>

              <div className="field field--full">
                <label className="field__label" htmlFor="bf-description">Description</label>
                <textarea
                  id="bf-description" className="field__textarea" rows={4} value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Shown on the book's detail page (Markdown supported)..."
                />
              </div>

              {/* Book file */}
              <div className="field field--full">
                <label className="field__label">
                  Book File {!isEditMode && <span className="field__label--required" />}
                </label>
                {isEditMode && initial && !bookFile && (
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                    Current: {initial.originalFilename} ({initial.fileType})
                  </p>
                )}
                {bookFile && (
                  <p style={{ fontSize: 13, marginBottom: 8 }}>Selected: {bookFile.name}</p>
                )}
                <input
                  ref={bookFileInputRef} type="file"
                  accept=".pdf,.txt,.md,.sh,.sql,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: 'none' }} onChange={handleBookFileChange}
                />
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => bookFileInputRef.current?.click()}>
                  {isEditMode ? 'Replace file' : 'Choose file'}
                </button>
                {bookFileError && <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-error)' }}>{bookFileError}</p>}
                <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  PDF, TXT, MD, SH, SQL, or DOCX — max 50 MB. {isEditMode && 'Replacing the file resets any saved reading progress for this book.'}
                </p>
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
              </div>

              {/* Downloadable */}
              <div className="field">
                <label className="field__label">Download button</label>
                <div className="status-toggle">
                  <button type="button" className={`status-toggle__option${downloadable ? ' status-toggle__option--active-published' : ''}`} onClick={() => setDownloadable(true)}>Allowed</button>
                  <button type="button" className={`status-toggle__option${!downloadable ? ' status-toggle__option--active-draft' : ''}`} onClick={() => setDownloadable(false)}>Read-only</button>
                </div>
                <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Read-only hides the Download button — it does not prevent the reader from saving the file via the browser.
                </p>
              </div>

              {visibility === 'PRIVATE' && (
                <div className="field field--full private-access-panel">
                  <label className="field__label">Metadata Visibility</label>
                  <div className="status-toggle" style={{ marginBottom: 16 }}>
                    <button type="button" className={`status-toggle__option${metadataVisibility === 'PUBLIC_METADATA' ? ' status-toggle__option--active-published' : ''}`} onClick={() => setMetadataVisibility('PUBLIC_METADATA')}>Show locked teaser</button>
                    <button type="button" className={`status-toggle__option${metadataVisibility === 'AUTHORIZED_ONLY' ? ' status-toggle__option--active-draft' : ''}`} onClick={() => setMetadataVisibility('AUTHORIZED_ONLY')}>Hide entirely</button>
                  </div>

                  <label className="field__label">Allowed Access Groups</label>
                  {availableGroups.length === 0 ? (
                    <p className="private-access-panel__empty">No access groups yet — create one under Admin → Access Groups.</p>
                  ) : (
                    <div className="checkbox-list">
                      {availableGroups.map((group) => (
                        <label key={group.id} className="checkbox-list__item">
                          <input
                            type="checkbox" checked={selectedGroupIds.includes(group.id)}
                            onChange={(e) => setSelectedGroupIds((prev) => e.target.checked ? [...prev, group.id] : prev.filter((id) => id !== group.id))}
                          />
                          {group.name}
                          {!group.enabled && <span className="checkbox-list__hint"> (disabled)</span>}
                        </label>
                      ))}
                    </div>
                  )}

                  <label className="field__label" style={{ marginTop: 16 }}>
                    Specific Users <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(exception access)</span>
                  </label>
                  <input
                    className="field__input" type="text" placeholder="Search users by username or email..."
                    value={userSearch} onChange={(e) => setUserSearch(e.target.value)} style={{ marginBottom: 8 }}
                  />
                  <div className="checkbox-list checkbox-list--scroll">
                    {availableUsers
                      .filter((u) => !userSearch.trim() || u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
                      .map((user) => (
                        <label key={user.id} className="checkbox-list__item">
                          <input
                            type="checkbox" checked={selectedUserIds.includes(user.id)}
                            onChange={(e) => setSelectedUserIds((prev) => e.target.checked ? [...prev, user.id] : prev.filter((id) => id !== user.id))}
                          />
                          {user.username} <span className="checkbox-list__hint">({user.email})</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              <p className="field field--full" style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '-8px 0 0' }}>
                Visibility and access apply to all language versions of this book.
              </p>

              {/* Translations (docs/10-multilingual-content.md §4.7) */}
              <TranslationsPanel
                kind="book"
                language={language}
                onLanguageChange={setLanguage}
                isEditMode={isEditMode}
                entityId={initial?.id}
                translations={initial?.translations ?? []}
                translationStale={initial?.translationStale ?? null}
                adminEditPath={(id) => `/admin/books/${id}/edit`}
                onLinkExisting={async (targetId) => {
                  if (!initial) return;
                  await linkBookTranslation(initial.id, targetId);
                }}
                onMarkReviewed={async () => {
                  if (!initial) return;
                  await markBookTranslationReviewed(initial.id);
                }}
              />
            </div>

            <div className="post-form-actions">
              <button type="submit" disabled={submitting} className="btn btn--primary">
                {submitting ? 'Saving...' : isEditMode ? 'Save changes' : 'Create book'}
              </button>
              <button type="button" onClick={() => navigate('/admin/books')} disabled={submitting} className="btn btn--ghost">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
