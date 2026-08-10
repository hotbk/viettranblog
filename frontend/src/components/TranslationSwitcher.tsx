import { Link } from 'react-router-dom';
import type { TranslationRef } from '../types';
import { LANGUAGE_LABEL } from '../types';
import { isAuthenticated } from '../auth';

interface Props {
  translations: TranslationRef[];
  /** Builds the public detail URL for a sibling, e.g. `/posts/${slug}` or `/library/${slug}`. */
  publicPath: (slug: string) => string;
  /** Builds the admin edit URL for a DRAFT sibling (admin-only). Book has a
   * per-id edit route; Post does not (editing happens inline on the admin
   * list page) — pass the closest available URL. */
  adminEditPath: (id: number) => string;
}

/**
 * Inline language switcher for post/book detail pages
 * (docs/10-multilingual-content.md §4.4). Real `<Link>` navigation — never a
 * client-side content swap — so each language stays independently
 * crawlable, shareable, and back-button-correct.
 *
 * Renders nothing when there is no sibling to show (a greyed-out pill would
 * advertise content that doesn't exist). Public callers already only ever
 * receive PUBLISHED siblings in `translations`; DRAFT siblings only reach
 * this component for an authenticated admin, and are labelled + linked to
 * the admin edit surface instead of the public URL.
 */
export default function TranslationSwitcher({ translations, publicPath, adminEditPath }: Props) {
  const admin = isAuthenticated();
  const visible = translations.filter((t) => admin || t.status === 'PUBLISHED');
  if (visible.length === 0) return null;

  return (
    <div className="translation-switcher">
      <span className="translation-switcher__label">Also available in:</span>
      {visible.map((t) => (
        t.status === 'PUBLISHED' ? (
          <Link key={t.id} to={publicPath(t.slug)} className="translation-switcher__link">
            {LANGUAGE_LABEL[t.language]}
          </Link>
        ) : (
          <Link
            key={t.id}
            to={adminEditPath(t.id)}
            className="translation-switcher__link translation-switcher__link--draft"
            title="Draft — visible to admins only"
          >
            {LANGUAGE_LABEL[t.language]} <span className="translation-switcher__draft-badge">draft</span>
          </Link>
        )
      ))}
    </div>
  );
}
