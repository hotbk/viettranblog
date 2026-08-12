import { useRef, useState } from 'react';
import { uploadPostAttachment, deletePostAttachment, UnauthorizedError } from '../api';
import type { PostAttachment, AttachmentType } from '../types';

// Keyed by filename extension, not MIME type — matches the backend
// (PostAttachmentService), which classifies the same way because many
// browsers/OSes report no reliable Content-Type for .md (often "" or a
// generic fallback). Checking here too just means the error message shows
// up instantly instead of after a round trip.
const ALLOWED_EXTENSIONS: Record<string, AttachmentType> = {
  pdf: 'PDF',
  doc: 'DOC',
  docx: 'DOCX',
  txt: 'TXT',
  md: 'MD',
  sh: 'SH',
  sql: 'SQL',
  zip: 'ZIP',
};
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20 MB

const ICONS: Record<AttachmentType, string> = { PDF: '📕', DOC: '📄', DOCX: '📄', TXT: '📃', MD: '📝', SH: '⌨️', SQL: '🗄️', ZIP: '🗜️' };

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1).toLowerCase();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  postId: number;
  initialAttachments: PostAttachment[];
  onAuthError: () => void;
}

/** Attachment upload/list/delete panel embedded in the post edit form. Only
 * shown in edit mode — a post needs an id before files can be attached to it. */
export default function AttachmentManager({ postId, initialAttachments, onAuthError }: Props) {
  const [attachments, setAttachments] = useState<PostAttachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!(extensionOf(file.name) in ALLOWED_EXTENSIONS)) {
      setUploadError('Only PDF, DOC, DOCX, TXT, MD, SH, SQL, or ZIP files are accepted.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setUploadError('File must be 20 MB or smaller.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const created = await uploadPostAttachment(postId, file);
      setAttachments((prev) => [...prev, created]);
    } catch (err) {
      if (err instanceof UnauthorizedError) { onAuthError(); return; }
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(attachment: PostAttachment) {
    setDeleteError(null);
    setDeletingId(attachment.id);
    try {
      await deletePostAttachment(postId, attachment.id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (err) {
      if (err instanceof UnauthorizedError) { onAuthError(); return; }
      setDeleteError('Failed to remove attachment — try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="field field--full">
      <label className="field__label">Attachments</label>

      {attachments.length === 0 && (
        <p className="attachment-manager__empty">No attachments yet.</p>
      )}

      {attachments.length > 0 && (
        <ul className="attachment-manager__list">
          {attachments.map((a) => (
            <li key={a.id} className="attachment-manager__item">
              <span className="attachment-manager__icon" aria-hidden>{ICONS[a.attachmentType]}</span>
              <span className="attachment-manager__name">{a.originalFilename}</span>
              <span className="attachment-manager__size">{formatSize(a.fileSize)}</span>
              <button
                type="button"
                className="btn btn--sm cover-image-remove-btn"
                onClick={() => handleDelete(a)}
                disabled={deletingId === a.id}
              >
                {deletingId === a.id ? 'Removing...' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md,.sh,.sql,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/zip"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : '+ Add file'}
      </button>

      {uploadError && (
        <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-error)' }}>{uploadError}</p>
      )}
      {deleteError && (
        <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-error)' }}>{deleteError}</p>
      )}

      <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>
        PDF, DOC, DOCX, TXT, MD, SH, SQL, or ZIP — max 20 MB each
      </p>
    </div>
  );
}
