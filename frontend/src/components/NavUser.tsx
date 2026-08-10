import { getUsername } from '../auth';
import { getMemberUsername } from '../memberAuth';

/**
 * Shows the logged-in username at the right edge of the nav bar. Checks the
 * admin session first, then the member session — mirrors auth.ts's
 * publicAuthHeader() precedence. Renders nothing when signed out; the
 * existing Admin/Exams links already cover the signed-out state.
 */
export default function NavUser() {
  const username = getUsername() ?? getMemberUsername();
  if (!username) return null;

  return (
    <span className="site-nav__user" title={username}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
        <path
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          d="M5 20c0-3.6 3.13-6.5 7-6.5s7 2.9 7 6.5"
        />
      </svg>
      {username}
    </span>
  );
}
