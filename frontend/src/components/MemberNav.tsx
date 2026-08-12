import { Link, useNavigate } from 'react-router-dom';
import NavBrand from './NavBrand';
import NavUser from './NavUser';
import ThemeToggle from './ThemeToggle';
import { memberLogout } from '../memberAuth';

export type MemberNavPage = 'exams' | 'history';

/**
 * Single source of truth for the member-area navbar (exams list, history,
 * login, register, exam-taking, attempt result). Each of these pages used
 * to hand-copy this markup and quietly diverge — a different link subset
 * on nearly every page, and Sign out/History missing on some — the same
 * pattern SiteNav.tsx fixed for the public pages.
 *
 * `back` renders a single "← Exams" link instead of the full set, for the
 * focused exam-taking/result screens where extra navigation is a
 * distraction. `guest` renders just "Home" and drops the Sign out button,
 * for the signed-out login/register screens — a full link set there would
 * just bounce back to /member/login via RequireMember — and keeps the nav
 * non-sticky to match their centered-form layout.
 */
export default function MemberNav({
  active,
  back,
  guest = false,
}: {
  active?: MemberNavPage;
  back?: { to: string; label: string };
  guest?: boolean;
}) {
  const navigate = useNavigate();
  const linkClass = (page: MemberNavPage) =>
    `site-nav__link${active === page ? ' site-nav__link--active' : ''}`;

  function handleLogout() {
    memberLogout();
    navigate('/member/login');
  }

  return (
    <nav className="site-nav" style={guest ? { position: 'static', marginBottom: 0 } : undefined}>
      <div className="site-nav__inner">
        <NavBrand />
        <div className="site-nav__links">
          {guest ? (
            <Link to="/" className="site-nav__link">Home</Link>
          ) : back ? (
            <Link to={back.to} className="site-nav__link">{back.label}</Link>
          ) : (
            <>
              <Link to="/" className="site-nav__link">Home</Link>
              <Link to="/series" className="site-nav__link">Series</Link>
              <Link to="/member/exams" className={linkClass('exams')}>Exams</Link>
              <Link to="/member/history" className={linkClass('history')}>History</Link>
            </>
          )}
          {!guest && !back && (
            <button className="btn btn--ghost btn--sm" onClick={handleLogout} style={{ marginLeft: 8 }}>
              Sign out
            </button>
          )}
          <ThemeToggle />
          <NavUser />
        </div>
      </div>
    </nav>
  );
}
