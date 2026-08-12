import { FONT_SIZE_LABEL, type FontSize } from '../readingPrefs';

/**
 * Small toolbar above the article on PostDetail: step the body text size
 * up/down, and hide the Related Posts sidebar to give the article the full
 * container width. Both choices are controlled by the parent (which persists
 * them via readingPrefs) — this component is just the UI.
 */
export default function ReadingControls({
  fontSize,
  onFontSizeStep,
  hideRelated,
  onHideRelatedChange,
}: {
  fontSize: FontSize;
  onFontSizeStep: (direction: 'inc' | 'dec') => void;
  hideRelated: boolean;
  onHideRelatedChange: (hide: boolean) => void;
}) {
  return (
    <div className="reading-controls">
      <div className="reading-controls__group" role="group" aria-label="Text size">
        <button
          type="button"
          className="reading-controls__btn"
          onClick={() => onFontSizeStep('dec')}
          disabled={fontSize === 'sm'}
          aria-label="Decrease text size"
          title="Decrease text size"
        >
          A&#8211;
        </button>
        <span className="reading-controls__size-label" aria-live="polite">{FONT_SIZE_LABEL[fontSize]}</span>
        <button
          type="button"
          className="reading-controls__btn"
          onClick={() => onFontSizeStep('inc')}
          disabled={fontSize === 'xl'}
          aria-label="Increase text size"
          title="Increase text size"
        >
          A+
        </button>
      </div>

      <label className="reading-controls__toggle">
        <input
          type="checkbox"
          checked={hideRelated}
          onChange={(e) => onHideRelatedChange(e.target.checked)}
        />
        <span>Hide related posts</span>
      </label>
    </div>
  );
}
