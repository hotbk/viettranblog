import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../auth';
import ThemeToggle from './ThemeToggle';

export type AdminTopbarPage =
  | 'posts' | 'series' | 'exams' | 'attempts' | 'books' | 'tools'
  | 'users' | 'accessGroups' | 'accessRequests' | 'auditLogs' | 'about';

const FULL_LINKS: { page: AdminTopbarPage; to: string; label: string }[] = [
  { page: 'posts', to: '/admin/posts', label: 'Posts' },
  { page: 'series', to: '/admin/series', label: 'Series' },
  { page: 'exams', to: '/admin/exams', label: 'Exams' },
  { page: 'attempts', to: '/admin/attempts', label: 'Attempts' },
  { page: 'books', to: '/admin/books', label: 'Books' },
  { page: 'tools', to: '/admin/tools', label: 'Tools' },
  { page: 'users', to: '/admin/users', label: 'Users' },
  { page: 'accessGroups', to: '/admin/access-groups', label: 'Access Groups' },
  { page: 'accessRequests', to: '/admin/access-requests', label: 'Access Requests' },
  { page: 'auditLogs', to: '/admin/audit-logs', label: 'Audit Logs' },
  { page: 'about', to: '/admin/about', label: 'About' },
];

/**
 * Single source of truth for the admin-panel topbar. Every admin page used
 * to hand-copy this markup and each one quietly diverged — a different link
 * subset and order on nearly every list page (Attempts/Access
 * Groups/Access Requests/Audit Logs missing here and there), while edit
 * forms mixed a "back to list" link with a random assortment of the full
 * set. Two variants now: `active` renders the full canonical link set for
 * list pages; `back` renders a single "back to list" link for detail/edit
 * forms, where the full set is a distraction.
 */
export default function AdminTopbar({
  active,
  back,
}: {
  active?: AdminTopbarPage;
  back?: { to: string; label: string };
}) {
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/admin/login');
  }

  return (
    <header className="admin-topbar">
      <div className="admin-topbar__inner">
        <div className="admin-topbar__brand">
          <span className="admin-topbar__brand-name">TECH2BLOGS</span>
          <span className="admin-topbar__brand-sub">Admin Panel</span>
        </div>
        <div className="admin-topbar__actions">
          <ThemeToggle />
          {back ? (
            <Link to={back.to} className="admin-topbar__view-site">{back.label}</Link>
          ) : (
            FULL_LINKS.map(({ page, to, label }) => (
              <Link
                key={page}
                to={to}
                className={`admin-topbar__view-site${active === page ? ' admin-topbar__view-site--active' : ''}`}
              >
                {label}
              </Link>
            ))
          )}
          <Link to="/" className="admin-topbar__view-site">View site &rarr;</Link>
          <button className="btn--topbar-logout" onClick={handleLogout}>Sign out</button>
        </div>
      </div>
    </header>
  );
}
