import { useState } from 'react';

interface Props {
  onInsert: (snippet: string) => void;
  label?: string;
}

/** Extracts the 11-char video id from watch/share/shorts/embed YouTube URL forms. */
function extractYoutubeId(url: string): string | null {
  const match = url
    .trim()
    .match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function YoutubeEmbedButton({ onInsert, label = 'Embed YouTube' }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const id = extractYoutubeId(url);
    if (!id) {
      setError('Not a recognizable YouTube URL');
      return;
    }
    onInsert(
      `<div class="post-video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" ` +
      `title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; ` +
      `encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`
    );
    setUrl('');
    setError(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        style={{ fontSize: 13 }}
        onClick={() => setOpen(true)}
      >
        ▶ {label}
      </button>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
        placeholder="Paste YouTube URL..."
        autoFocus
        style={{ fontSize: 13, padding: '4px 8px', minWidth: 220 }}
      />
      <button type="button" className="btn btn--ghost btn--sm" style={{ fontSize: 13 }} onClick={handleAdd}>
        Add
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        style={{ fontSize: 13 }}
        onClick={() => { setOpen(false); setUrl(''); setError(null); }}
      >
        Cancel
      </button>
      {error && <span style={{ fontSize: 12, color: 'var(--color-error)' }}>{error}</span>}
    </span>
  );
}
