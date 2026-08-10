import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ContentLanguage, TranslationRef } from '../types';
import { LANGUAGE_LABEL } from '../types';

const OTHER_LANGUAGE: Record<ContentLanguage, ContentLanguage> = { VI: 'EN', EN: 'VI' };

interface Props {
  kind: 'post' | 'book';
  language: ContentLanguage;
  onLanguageChange: (lang: ContentLanguage) => void;
  /** Only meaningful in edit mode — a brand-new, unsaved row has no group yet. */
  isEditMode: boolean;
  entityId?: number;
  translations: TranslationRef[];
  /** null when unknown (public reads never send it) or this row isn't a translation of anything. */
  translationStale: boolean | null;
  /** Builds the admin edit URL for a sibling — Book has a real per-id route;
   * Post doesn't (editing happens inline on the admin list page), so it
   * points at the list instead. */
  adminEditPath: (id: number) => string;
  /** Omitted for Book: creating a linked row always needs a file upload, which this
   * panel has no UI for. Book admins use the regular "+ New Book" flow, then
   * "Link to an existing book" below — see the fallback hint rendered when this
   * is absent. */
  onCreateLinked?: (opts: { language: ContentLanguage; copyContent: boolean }) => Promise<void>;
  onLinkExisting: (targetId: number) => Promise<void>;
  onMarkReviewed: () => Promise<void>;
}

/**
 * "Translations" panel — one place, below the access-control panel, in both
 * PostForm and AdminBookForm (docs/10-multilingual-content.md §4.7).
 * Deliberately not extracted further into per-domain subcomponents — the
 * shape (TranslationRef) and the actions (create-linked / link-existing /
 * mark-reviewed) are identical for Post and Book; only the API calls the
 * parent form wires up differ.
 */
export default function TranslationsPanel({
  kind, language, onLanguageChange, isEditMode, entityId, translations, translationStale,
  adminEditPath, onCreateLinked, onLinkExisting, onMarkReviewed,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [linkTargetId, setLinkTargetId] = useState('');

  const otherLanguage = OTHER_LANGUAGE[language];
  const hasOtherLanguageSibling = translations.some((t) => t.language === otherLanguage);
  const noun = kind === 'post' ? 'post' : 'book';

  async function run(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function handleLinkExisting() {
    const targetId = Number(linkTargetId.trim());
    if (!linkTargetId.trim() || Number.isNaN(targetId)) {
      setError('Enter a valid post ID to link.');
      return;
    }
    const confirmed = window.confirm(
      `This will apply the target ${noun}'s visibility and access grants to this ${noun}. Continue?`,
    );
    if (!confirmed) return;
    run(() => onLinkExisting(targetId), 'Linked — reload the list to see the updated group.').then(() => {
      setLinkTargetId('');
    });
  }

  return (
    <div className="field field--full private-access-panel">
      <label className="field__label">Translations</label>

      <div style={{ marginBottom: 16 }}>
        <label className="field__label" htmlFor="tp-language" style={{ fontWeight: 400 }}>
          Language
        </label>
        <div className="status-toggle" style={{ maxWidth: 220 }} id="tp-language">
          {(['VI', 'EN'] as ContentLanguage[]).map((lang) => (
            <button
              key={lang}
              type="button"
              className={`status-toggle__option${language === lang ? ' status-toggle__option--active-published' : ''}`}
              onClick={() => onLanguageChange(lang)}
            >
              {LANGUAGE_LABEL[lang]}
            </button>
          ))}
        </div>
      </div>

      {isEditMode && entityId != null && (
        <>
          {translations.length > 0 ? (
            <ul className="checkbox-list" style={{ listStyle: 'none', padding: 0 }}>
              {translations.map((t) => (
                <li key={t.id} className="checkbox-list__item" style={{ justifyContent: 'space-between' }}>
                  <span>
                    <strong>{LANGUAGE_LABEL[t.language]}</strong> — {t.title}{' '}
                    <span className={`badge ${t.status === 'PUBLISHED' ? 'badge--published' : 'badge--draft'}`}>
                      {t.status}
                    </span>{' '}
                    {t.visibility === 'PRIVATE' && <span className="badge badge--private">🔒 Private</span>}
                  </span>
                  <Link to={adminEditPath(t.id)} className="btn btn--ghost btn--sm">Edit</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="private-access-panel__empty">No translation yet.</p>
          )}

          {translationStale === true && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--color-error)', marginBottom: 6 }}>
                The source article has changed since this translation was last reviewed.
              </p>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={busy}
                onClick={() => run(onMarkReviewed, 'Marked as reviewed.')}
              >
                Mark as reviewed
              </button>
            </div>
          )}

          {!hasOtherLanguageSibling && onCreateLinked && (
            <div style={{ marginTop: 16 }}>
              <label className="field__label" style={{ fontWeight: 400 }}>
                Create {LANGUAGE_LABEL[otherLanguage]} version
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={busy}
                  onClick={() => run(
                    () => onCreateLinked({ language: otherLanguage, copyContent: false }),
                    `Created an empty ${LANGUAGE_LABEL[otherLanguage]} draft — find it in the list to edit.`,
                  )}
                >
                  + Empty
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={busy}
                  onClick={() => run(
                    () => onCreateLinked({ language: otherLanguage, copyContent: true }),
                    `Copied content into a new ${LANGUAGE_LABEL[otherLanguage]} draft — find it in the list to edit.`,
                  )}
                >
                  + Copy source content
                </button>
              </div>
            </div>
          )}

          {!hasOtherLanguageSibling && !onCreateLinked && (
            <p className="private-access-panel__empty" style={{ marginTop: 16 }}>
              To add a {LANGUAGE_LABEL[otherLanguage]} version, create a new {noun} normally
              (it needs its own file upload), then link it below.
            </p>
          )}

          <div style={{ marginTop: 16 }}>
            <label className="field__label" htmlFor="tp-link-target" style={{ fontWeight: 400 }}>
              Link to an existing {noun} (by ID)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="tp-link-target"
                className="field__input"
                type="text"
                inputMode="numeric"
                placeholder={`${noun} ID`}
                value={linkTargetId}
                onChange={(e) => setLinkTargetId(e.target.value)}
                style={{ maxWidth: 160 }}
              />
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={handleLinkExisting}>
                Link
              </button>
            </div>
          </div>
        </>
      )}

      {!isEditMode && (
        <p className="private-access-panel__empty">Save this {noun} first to link or create a translation.</p>
      )}

      {notice && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-success, #065f46)' }}>{notice}</p>}
      {error && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-error)' }}>{error}</p>}
    </div>
  );
}
