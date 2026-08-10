import type { CSSProperties } from 'react';
import type { HighlightColor } from '../types';

const POPUP_WIDTH = 240;
const POPUP_HEIGHT = 48;
const MARGIN = 8;

export const HIGHLIGHT_COLORS: HighlightColor[] = ['YELLOW', 'GREEN', 'PINK', 'BLUE'];

/**
 * Fixed-position placement for a selection popup, flipped above/below the
 * selection to stay in the viewport and clamped horizontally — shared by
 * HighlightPopup and HighlightNoteEditor so the note editor opens exactly
 * where the popup was (see docs/09-book-highlights-phase2.md §6.1).
 */
export function computePopupStyle(rect: DOMRect, height = POPUP_HEIGHT): CSSProperties {
  const spaceAbove = rect.top;
  const placeBelow = spaceAbove < height + MARGIN * 2;
  const top = placeBelow ? rect.bottom + MARGIN : rect.top - height - MARGIN;
  const centerX = rect.left + rect.width / 2;
  const left = Math.min(Math.max(centerX - POPUP_WIDTH / 2, MARGIN), window.innerWidth - POPUP_WIDTH - MARGIN);
  return { position: 'fixed', top: Math.max(MARGIN, top), left, width: POPUP_WIDTH, zIndex: 80 };
}

interface Props {
  rect: DOMRect;
  loggedIn: boolean;
  onPickColor: (color: HighlightColor) => void;
  onAddNote: () => void;
  onSignIn: () => void;
  onClose: () => void;
}

/** The floating toolbar shown on a text selection — see §6.1's file table. */
export default function HighlightPopup({ rect, loggedIn, onPickColor, onAddNote, onSignIn, onClose }: Props) {
  if (!loggedIn) {
    return (
      <div className="highlight-popup" style={computePopupStyle(rect)}>
        <span className="highlight-popup__signin-text">Sign in to save highlights</span>
        <button type="button" className="highlight-popup__signin-btn" onClick={onSignIn}>Sign in</button>
        <button type="button" className="highlight-popup__close" onMouseDown={(e) => e.preventDefault()} onClick={onClose} aria-label="Dismiss">✕</button>
      </div>
    );
  }

  // onMouseDown preventDefault on every button here: a plain click first fires
  // mousedown, which by default steals focus from the document and collapses
  // window.getSelection() *before* the click (and this component's onPickColor/
  // onAddNote) ever runs — so the selection the reader just made would already
  // be gone by the time we try to read it. Preventing mousedown's default
  // keeps the selection alive through the click.
  return (
    <div className="highlight-popup" style={computePopupStyle(rect)}>
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`highlight-popup__swatch highlight-popup__swatch--${color.toLowerCase()}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPickColor(color)}
          aria-label={`Highlight in ${color.toLowerCase()}`}
        />
      ))}
      <button type="button" className="highlight-popup__note-btn" onMouseDown={(e) => e.preventDefault()} onClick={onAddNote}>+ Note</button>
      <button type="button" className="highlight-popup__close" onMouseDown={(e) => e.preventDefault()} onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
}
