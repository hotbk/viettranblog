import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  backTo: string;
  percent: number;
  downloadUrl?: string | null;
  children?: ReactNode;
}

export default function ReaderToolbar({ title, backTo, percent, downloadUrl, children }: Props) {
  return (
    <>
      <div className="reader-toolbar">
        <Link to={backTo} className="reader-toolbar__back">&larr; Back</Link>
        <span className="reader-toolbar__title">{title}</span>
        <div className="reader-toolbar__controls">
          {children}
          {downloadUrl && (
            <a href={downloadUrl} className="reader-toolbar__btn" download>
              Download
            </a>
          )}
        </div>
      </div>
      <div className="reader-toolbar__progress">
        <div className="reader-toolbar__progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </>
  );
}
