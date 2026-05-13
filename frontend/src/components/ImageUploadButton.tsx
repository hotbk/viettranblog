import { useRef, useState } from 'react';
import { uploadContentImage, UnauthorizedError } from '../api';

interface Props {
  onInsert: (markdownSnippet: string) => void;
  onAuthError: () => void;
  label?: string;
}

export default function ImageUploadButton({ onInsert, onAuthError, label = 'Insert image' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadContentImage(file);
      const alt = file.name.replace(/\.[^.]+$/, '');
      onInsert(`![${alt}](${url})`);
    } catch (err) {
      if (err instanceof UnauthorizedError) { onAuthError(); return; }
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        style={{ fontSize: 13 }}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Uploading...' : `🖼 ${label}`}
      </button>
      {error && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </span>
  );
}
