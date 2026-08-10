import { useState } from 'react';
import type { BookHighlight } from '../types';
import HighlightNoteEditor from './HighlightNoteEditor';

interface Props {
  open: boolean;
  highlights: BookHighlight[];
  onClose: () => void;
  onJump: (highlight: BookHighlight) => void;
  onUpdateNote: (id: number, note: string | null) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

/** Slide-over panel listing this book's highlights — click a row to jump to it
 * in the reader; edit its note or delete it in place. See §6.1. */
export default function BookHighlightsPanel({ open, highlights, onClose, onJump, onUpdateNote, onDelete }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  if (!open) return null;

  async function saveNote(id: number, note: string) {
    setSavingId(id);
    try {
      await onUpdateNote(id, note.trim() || null);
      setEditingId(null);
    } catch {
      // useBookHighlights already reverted the optimistic state and set an error.
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="highlights-panel">
      <div className="highlights-panel__header">
        <span className="highlights-panel__title">Highlights in this book</span>
        <button type="button" className="highlight-popup__close" onClick={onClose} aria-label="Close highlights panel">✕</button>
      </div>

      {highlights.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 16px' }}>
          <p className="empty-state__title">No highlights in this book yet</p>
          <p className="empty-state__desc">Select text to add one.</p>
        </div>
      ) : (
        <ul className="highlights-panel__list">
          {highlights.map((h) => (
            <li key={h.id} className="highlights-panel__item">
              <button
                type="button"
                className={`highlights-panel__swatch highlight-popup__swatch--${h.color.toLowerCase()}`}
                onClick={() => onJump(h)}
                aria-label="Jump to this highlight"
              />
              <div className="highlights-panel__body">
                <button type="button" className="highlights-panel__snippet" onClick={() => onJump(h)}>
                  {h.text}
                </button>
                {h.stale && <span className="highlights-panel__stale">File changed since this was saved — position may be off</span>}

                {editingId === h.id ? (
                  <HighlightNoteEditor
                    mode="edit"
                    color={h.color}
                    initialNote={h.note ?? ''}
                    saving={savingId === h.id}
                    onSave={(note) => saveNote(h.id, note)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : h.note ? (
                  <button type="button" className="highlights-panel__note" onClick={() => setEditingId(h.id)}>
                    {h.note}
                  </button>
                ) : (
                  <button type="button" className="highlights-panel__add-note" onClick={() => setEditingId(h.id)}>
                    + Add note
                  </button>
                )}
              </div>
              <button
                type="button"
                className="highlights-panel__delete"
                onClick={() => onDelete(h.id)}
                aria-label="Delete highlight"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
