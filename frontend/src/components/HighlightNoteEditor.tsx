import { useState, type CSSProperties } from 'react';
import type { HighlightColor } from '../types';
import { HIGHLIGHT_COLORS, computePopupStyle } from './HighlightPopup';

const NOTE_MAX = 2000;

interface Props {
  /** Selection's bounding rect — when given, the editor floats near it (create-with-note
   * and click-to-edit-in-reader). Omitted for the inline case (BookHighlightsPanel row). */
  rect?: DOMRect;
  mode: 'create' | 'edit';
  color: HighlightColor;
  /** Only used in 'create' mode — an existing highlight's color can't be changed (PUT only edits the note). */
  onSelectColor?: (color: HighlightColor) => void;
  initialNote?: string;
  saving?: boolean;
  onSave: (note: string) => void;
  onCancel: () => void;
  /** 'edit' mode only — lets the click-an-existing-highlight popup also delete it. */
  onDelete?: () => void;
}

/** Add/edit-note popover — shared by "highlight + note" creation and editing an
 * existing highlight's note, in-reader or from the panel (§6.1). */
export default function HighlightNoteEditor({
  rect, mode, color, onSelectColor, initialNote = '', saving, onSave, onCancel, onDelete,
}: Props) {
  const [note, setNote] = useState(initialNote);
  const floating = rect != null;
  const style: CSSProperties = floating ? computePopupStyle(rect!, 160) : {};

  return (
    <div className={floating ? 'highlight-popup highlight-popup--note' : 'highlight-note-editor--inline'} style={style}>
      {mode === 'create' && onSelectColor && (
        <div className="highlight-popup__swatches">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`highlight-popup__swatch highlight-popup__swatch--${c.toLowerCase()}${c === color ? ' highlight-popup__swatch--selected' : ''}`}
              onClick={() => onSelectColor(c)}
              aria-label={`Use ${c.toLowerCase()}`}
            />
          ))}
        </div>
      )}
      <textarea
        className="highlight-note-editor__textarea"
        placeholder="Add a note (optional)..."
        value={note}
        maxLength={NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        autoFocus
      />
      <div className="highlight-note-editor__actions">
        <span className="highlight-note-editor__count">{note.length}/{NOTE_MAX}</span>
        {mode === 'edit' && onDelete && (
          <button type="button" className="highlight-note-editor__delete" onClick={onDelete} disabled={saving} aria-label="Delete highlight">
            🗑
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => onSave(note)} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
