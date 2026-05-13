import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  fetchAdminUsers,
  createUser,
  updateUserRole,
  deleteUser,
  UnauthorizedError,
} from '../api';
import type { UserResponse, CreateUserRequest } from '../api';
import { logout } from '../auth';

type Role = 'ADMIN' | 'EDITOR' | 'READER' | 'MEMBER';

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastId = 0;

const ROLE_LABELS: Record<Role, string> = { ADMIN: 'Admin', EDITOR: 'Editor', READER: 'Reader', MEMBER: 'Member' };

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'badge--admin',
  EDITOR: 'badge--editor',
  READER: 'badge--reader',
  MEMBER: 'badge--draft',
};

const EMPTY_FORM: CreateUserRequest = { username: '', email: '', password: '', role: 'READER' };

export default function AdminUsers() {
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateUserRequest>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  function showToast(message: string, type: 'success' | 'error') {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  function handleUnauth() {
    logout();
    navigate('/admin/login');
  }

  async function loadUsers() {
    setLoading(true);
    setFetchError(null);
    try {
      setUsers(await fetchAdminUsers());
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
      setFetchError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/admin/login');
  }

  // ── Create user ────────────────────────────────────────────────────────────

  function validateForm(): string | null {
    if (!form.username.trim()) return 'Username is required';
    if (form.username.length < 3) return 'Username must be at least 3 characters';
    if (!form.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Invalid email format';
    if (!form.password) return 'Password is required';
    if (form.password.length < 6) return 'Password must be at least 6 characters';
    return null;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const err = validateForm();
    if (err) { setFormError(err); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createUser(form);
      setUsers((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      showToast(`User "${created.username}" created.`, 'success');
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
      setFormError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Change role ────────────────────────────────────────────────────────────

  async function handleRoleChange(user: UserResponse, newRole: Role) {
    if (newRole === user.role) return;
    try {
      const updated = await updateUserRole(user.id, newRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      showToast(`${user.username}'s role updated to ${ROLE_LABELS[newRole]}.`, 'success');
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
      showToast(err instanceof Error ? err.message : 'Failed to update role', 'error');
    }
  }

  // ── Delete user ────────────────────────────────────────────────────────────

  async function handleDelete(user: UserResponse) {
    if (!window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    try {
      await deleteUser(user.id);
      showToast(`User "${user.username}" deleted.`, 'success');
    } catch (err) {
      setUsers((prev) => [user, ...prev]);
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
      showToast(err instanceof Error ? err.message : 'Failed to delete user', 'error');
    }
  }

  return (
    <>
      {/* ── Admin Topbar ──────────────────────── */}
      <header className="admin-topbar">
        <div className="admin-topbar__inner">
          <div className="admin-topbar__brand">
            <span className="admin-topbar__brand-name">viettran Blog</span>
            <span className="admin-topbar__brand-sub">Admin Panel</span>
          </div>
          <div className="admin-topbar__actions">
            <Link to="/admin/posts" className="admin-topbar__view-site">Posts</Link>
            <Link to="/admin/exams" className="admin-topbar__view-site">Exams</Link>
            <Link to="/admin/attempts" className="admin-topbar__view-site">Attempts</Link>
            <Link to="/admin/series" className="admin-topbar__view-site">Series</Link>
            <Link to="/" className="admin-topbar__view-site">View site &rarr;</Link>
            <button className="btn--topbar-logout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <div className="admin-posts-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Users</h1>
            <p className="admin-page-subtitle">
              {loading ? 'Loading...' : `${users.length} user${users.length !== 1 ? 's' : ''} total`}
            </p>
          </div>
          <button
            className="btn btn--accent"
            onClick={() => { setShowForm(true); setFormError(null); }}
            disabled={showForm}
          >
            + New User
          </button>
        </div>

        {/* ── Create form ─────────────────────── */}
        {showForm && (
          <div className="post-form-wrap">
            <form onSubmit={handleCreate} noValidate>
              <div className="post-form-header">
                <h2 className="post-form-title">New User</h2>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null); }}>
                  Cancel
                </button>
              </div>

              {formError && (
                <div className="error-banner" style={{ marginBottom: 16 }}>
                  <span className="error-banner__text">{formError}</span>
                </div>
              )}

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="u-username">Username</label>
                  <input
                    id="u-username"
                    className="form-input"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="e.g. john_doe"
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="u-email">Email</label>
                  <input
                    id="u-email"
                    type="email"
                    className="form-input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="e.g. john@example.com"
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="u-password">Password</label>
                  <input
                    id="u-password"
                    type="password"
                    className="form-input"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="u-role">Role</label>
                  <select
                    id="u-role"
                    className="form-input"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  >
                    <option value="READER">Reader</option>
                    <option value="EDITOR">Editor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn btn--accent" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Loading ─────────────────────────── */}
        {loading && (
          <div className="spinner-wrap">
            <div className="spinner" />
            <span className="spinner-label">Loading users...</span>
          </div>
        )}

        {/* ── Fetch error ─────────────────────── */}
        {!loading && fetchError && (
          <div className="error-banner">
            <span className="error-banner__text">{fetchError}</span>
            <button className="error-banner__retry" onClick={loadUsers}>Retry</button>
          </div>
        )}

        {/* ── Empty state ─────────────────────── */}
        {!loading && !fetchError && users.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">&#128100;</div>
            <p className="empty-state__title">No users yet</p>
            <p className="empty-state__desc">Create the first user to get started.</p>
            <button className="btn btn--accent" onClick={() => setShowForm(true)} style={{ marginTop: 16 }}>
              + New User
            </button>
          </div>
        )}

        {/* ── Users table ─────────────────────── */}
        {!loading && !fetchError && users.length > 0 && (
          <div className="posts-table-wrap">
            <table className="posts-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="post-title-cell__title">{user.username}</div>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{user.email}</td>
                    <td>
                      <span className={`badge ${ROLE_BADGE[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                      {formatDate(user.createdAt)}
                    </td>
                    <td>
                      <div className="table-actions">
                        <select
                          className="form-input form-input--sm"
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value as Role)}
                          title="Change role"
                        >
                          <option value="READER">Reader</option>
                          <option value="EDITOR">Editor</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button
                          className="btn btn--danger-ghost btn--sm"
                          onClick={() => handleDelete(user)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </>
  );
}
