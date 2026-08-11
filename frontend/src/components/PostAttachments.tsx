import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchAttachmentBlob } from '../api';
import type { PostAttachment, AttachmentType } from '../types';

const ICONS: Record<AttachmentType, string> = { PDF: '📕', DOC: '📄', DOCX: '📄', TXT: '📃', MD: '📝', ZIP: '🗜️' };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Attachments section on the post-detail page — clicking a file opens it in an
 * inline viewer instead of just downloading it. Hidden entirely when a post has
 * no attachments, same convention as tags/cover image elsewhere on this page. */
export default function PostAttachments({ attachments }: { attachments: PostAttachment[] }) {
  const [viewing, setViewing] = useState<PostAttachment | null>(null);

  if (attachments.length === 0) return null;

  return (
    <section className="post-attachments">
      <h2 className="post-attachments__title">Attachments</h2>
      <ul className="post-attachments__list">
        {attachments.map((a) => (
          <li key={a.id} className="post-attachments__item">
            <button type="button" className="post-attachments__button" onClick={() => setViewing(a)}>
              <span className="post-attachments__icon" aria-hidden>{ICONS[a.attachmentType]}</span>
              <span className="post-attachments__name">{a.originalFilename}</span>
              <span className="post-attachments__meta">{a.attachmentType} · {formatSize(a.fileSize)}</span>
            </button>
          </li>
        ))}
      </ul>

      {viewing && (
        // key forces a fresh instance per attachment, so state resets to its initial
        // values (loading, no content) without an extra setState-on-mount effect.
        <AttachmentViewerModal key={viewing.id} attachment={viewing} onClose={() => setViewing(null)} />
      )}
    </section>
  );
}

type ViewState = 'loading' | 'ready' | 'error';

function AttachmentViewerModal({ attachment, onClose }: { attachment: PostAttachment; onClose: () => void }) {
  const [state, setState] = useState<ViewState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    async function load() {
      try {
        const blob = await fetchAttachmentBlob(attachment.url);
        if (cancelled) return;

        if (attachment.attachmentType === 'TXT' || attachment.attachmentType === 'MD') {
          const text = await blob.text();
          if (cancelled) return;
          setTextContent(text);
        } else if (attachment.attachmentType === 'DOCX') {
          const arrayBuffer = await blob.arrayBuffer();
          // Lazy-loaded — mammoth + its deps only ship to viewers who actually open a DOCX.
          const mammothModule = await import('mammoth');
          const mammoth = (mammothModule as unknown as { default?: typeof mammothModule }).default
            ?? mammothModule;
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (cancelled) return;
          setDocxHtml(result.value);
        } else {
          // PDF: browsers render it natively in an <iframe>. DOC/ZIP: no safe in-browser
          // renderer exists for a legacy binary format or an archive — offer download only.
          createdUrl = URL.createObjectURL(blob);
          setDownloadUrl(createdUrl);
        }
        if (!cancelled) setState('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load file');
          setState('error');
        }
      }
    }
    load();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attachment]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="attachment-modal-backdrop" onClick={onClose}>
      <div className="attachment-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="attachment-modal__header">
          <span className="attachment-modal__title">{attachment.originalFilename}</span>
          <div className="attachment-modal__actions">
            {downloadUrl && (
              <a href={downloadUrl} download={attachment.originalFilename} className="btn btn--ghost btn--sm">
                Download
              </a>
            )}
            <button type="button" className="attachment-modal__close" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>
        </div>

        <div className="attachment-modal__body">
          {state === 'loading' && (
            <div className="spinner-wrap" style={{ padding: '48px 0' }}>
              <div className="spinner" />
              <span className="spinner-label">Loading file...</span>
            </div>
          )}

          {state === 'error' && (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden>&#9888;&#65039;</div>
              <p className="empty-state__title">Couldn't load this file</p>
              <p className="empty-state__desc">{error}</p>
            </div>
          )}

          {state === 'ready' && attachment.attachmentType === 'PDF' && downloadUrl && (
            <iframe src={downloadUrl} title={attachment.originalFilename} className="attachment-modal__pdf" />
          )}

          {state === 'ready' && attachment.attachmentType === 'TXT' && (
            <pre className="attachment-modal__text">{textContent}</pre>
          )}

          {state === 'ready' && attachment.attachmentType === 'MD' && (
            <div className="attachment-modal__prose">
              <ReactMarkdown>{textContent ?? ''}</ReactMarkdown>
            </div>
          )}

          {state === 'ready' && attachment.attachmentType === 'DOCX' && (
            <div className="attachment-modal__docx" dangerouslySetInnerHTML={{ __html: docxHtml ?? '' }} />
          )}

          {state === 'ready' && attachment.attachmentType === 'DOC' && (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden>📄</div>
              <p className="empty-state__title">Preview not available for .doc files</p>
              <p className="empty-state__desc">
                The legacy Word format can't be safely previewed in the browser. Use the
                Download button above to open it locally.
              </p>
            </div>
          )}

          {state === 'ready' && attachment.attachmentType === 'ZIP' && (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden>🗜️</div>
              <p className="empty-state__title">Preview not available for .zip files</p>
              <p className="empty-state__desc">
                Archives can't be previewed in the browser. Use the Download button above
                to open it locally.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
