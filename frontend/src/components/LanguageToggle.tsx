import { useState } from 'react';
import { getLanguagePreference, setLanguagePreference, type LanguagePreference } from '../contentLanguage';

const OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'VI', label: 'VI' },
  { value: 'EN', label: 'EN' },
  { value: 'ALL', label: 'All' },
];

/**
 * VI | EN | All reader language preference, next to the theme toggle
 * (docs/10-multilingual-content.md §4.3) — same persisted, header-level,
 * no-dependency pattern as theme.ts/ThemeToggle.
 *
 * `onChange` lets the owning page react immediately (re-fetch the filtered
 * list) without needing a global store for a two-page feature.
 */
export default function LanguageToggle({ onChange }: { onChange?: (pref: LanguagePreference) => void }) {
  const [pref, setPref] = useState<LanguagePreference>(() => getLanguagePreference());

  function handleSelect(next: LanguagePreference) {
    if (next === pref) return;
    setLanguagePreference(next);
    setPref(next);
    onChange?.(next);
  }

  return (
    <div className="language-toggle" role="group" aria-label="Content language preference">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`language-toggle__option${pref === opt.value ? ' language-toggle__option--active' : ''}`}
          aria-pressed={pref === opt.value}
          onClick={() => handleSelect(opt.value)}
          title={
            opt.value === 'ALL'
              ? 'Show posts and books in every language'
              : opt.value === 'VI'
                ? 'Show only Vietnamese content'
                : 'Show only English content'
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
