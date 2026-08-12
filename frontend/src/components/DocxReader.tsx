import { useEffect, useRef, useState } from 'react';

interface Props {
  blob: Blob;
  startPercent: number | null;
  onProgress: (percent: number) => void;
}

/** Client-side DOCX renderer. Mammoth is lazy-loaded so other book formats do
 * not pay its bundle cost. Upload remains admin-only, matching the existing
 * DOCX attachment trust boundary used elsewhere in the app. */
export default function DocxReader({ blob, startPercent, onProgress }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const mammothModule = await import('mammoth');
        const mammoth = (mammothModule as unknown as { default?: typeof mammothModule }).default
          ?? mammothModule;
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) setHtml(result.value);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to render DOCX file');
      }
    }
    render();
    return () => { cancelled = true; };
  }, [blob]);

  useEffect(() => {
    if (html == null || startPercent == null || !containerRef.current) return;
    const el = containerRef.current;
    el.scrollTop = ((el.scrollHeight - el.clientHeight) * startPercent) / 100;
  }, [html, startPercent]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    onProgress(scrollable > 0 ? Math.round((el.scrollTop / scrollable) * 100) : 100);
  }

  if (error) {
    return <div className="empty-state"><p className="empty-state__title">Couldn't open this DOCX file</p><p>{error}</p></div>;
  }
  if (html == null) {
    return <div className="spinner-wrap"><div className="spinner" /><span className="spinner-label">Rendering document...</span></div>;
  }

  return (
    <div className="reader-body" ref={containerRef} onScroll={handleScroll}>
      <article className="reader-body__docx" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
