import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import NavBrand from './NavBrand';
import NavUser from './NavUser';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { isAuthenticated } from '../auth';
import { isMemberAuthenticated } from '../memberAuth';
import type { LanguagePreference } from '../contentLanguage';

export type SiteNavPage = 'home' | 'series' | 'library' | 'about' | 'tools';

/**
 * Single source of truth for the primary site navbar. Every public page
 * (Home, Series list/detail, Library, book/post detail, About, My
 * Highlights, Tools) renders this same component so the link set can no
 * longer drift page-to-page — each page used to hand-copy this markup and
 * quietly diverge (missing Exams/Admin on some pages, a different set on
 * others).
 *
 * `active` highlights the current section. `extra` is a narrow escape
 * hatch for a single page-specific link (e.g. "My Highlights" only when
 * signed in on the Library pages), rendered in a fixed slot right after
 * About so the core link set never changes shape or order between pages.
 */
export default function SiteNav({
  active,
  extra,
  onLanguageChange,
}: {
  active?: SiteNavPage;
  extra?: ReactNode;
  onLanguageChange?: (pref: LanguagePreference) => void;
}) {
  const isMember = isMemberAuthenticated();
  const authenticated = isAuthenticated();
  const linkClass = (page: SiteNavPage) =>
    `site-nav__link${active === page ? ' site-nav__link--active' : ''}`;

  return (
    <nav className="site-nav">
      <div className="site-nav__inner">
        <NavBrand />
        <div className="site-nav__links">
          <Link to="/" className={linkClass('home')}>Home</Link>
          <Link to="/series" className={linkClass('series')}>Series</Link>
          <Link to="/library" className={linkClass('library')}>Library</Link>
          <Link to="/tools" className={linkClass('tools')}>Tools</Link>
          <Link to="/about" className={linkClass('about')}>About</Link>
          {extra}
          {isMember ? (
            <Link to="/member/exams" className="site-nav__link">Exams</Link>
          ) : (
            <Link to="/member/login" className="site-nav__link">Exams</Link>
          )}
          {authenticated ? (
            <Link to="/admin/posts" className="site-nav__link site-nav__link--accent">Admin</Link>
          ) : (
            <Link to="/admin/login" className="site-nav__link">Admin</Link>
          )}
          <LanguageToggle onChange={onLanguageChange} />
          <ThemeToggle />
          <NavUser />
        </div>
      </div>
    </nav>
  );
}
