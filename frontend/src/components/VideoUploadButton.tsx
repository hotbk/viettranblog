import { useRef, useState } from 'react';
import { uploadContentVideo, UnauthorizedError, MAX_VIDEO_UPLOAD_BYTES } from '../api';

interface Props {
  onInsert: (snippet: string) => void;
  onAuthError: () => void;
  label?: string;
}

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/x-msvideo'];

export default function VideoUploadButton({ onInsert, onAuthError, label = 'Insert video' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Invalid video type. Allowed: mp4, mov, webm, mkv, avi');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      setError('Video exceeds 200 MB limit');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const { url } = await uploadContentVideo(file);
      onInsert(`<video class="post-video" controls preload="metadata" src="${url}"></video>`);
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
        {uploading ? 'Uploading & transcoding...' : `🎬 ${label}`}
      </button>
      {error && <span style={{ fontSize: 12, color: 'var(--color-error)' }}>{error}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </span>
  );
}
