import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  fetchUserDetail,
  updateUserAccessGroups,
  updateUserStatus,
  fetchAccessGroups,
  UnauthorizedError,
} from '../api';
import type { UserDetailResponseDto } from '../api';
import type { AccessGroup, UserStatus } from '../types';
import { logout } from '../auth';
import AdminTopbar from '../components/AdminTopbar';

const STATUS_LABELS: Record<UserStatus, string> = {
  PENDING: 'Pending', ACTIVE: 'Active', REJECTED: 'Rejected', SUSPENDED: 'Suspended',
};

const STATUS_BADGE: Record<UserStatus, string> = {
  PENDING: 'badge--draft', ACTIVE: 'badge--published', REJECTED: 'badge--danger', SUSPENDED: 'badge--danger',
};

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserDetailResponseDto | null>(null);
  const [allGroups, setAllGroups] = useState<AccessGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handleUnauth() {
    logout();
    navigate('/admin/login');
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // Resets loading/error on every `id` change (navigating between user detail
    // pages without unmounting), not just on mount — needs the sync reset here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setFetchError(null);
    Promise.all([fetchUserDetail(Number(id)), fetchAccessGroups()])
      .then(([detail, groups]) => {
        if (cancelled) return;
        setUser(detail);
        setSelectedGroupIds(detail.accessGroups.map((g) => g.id));
        setAllGroups(groups);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) { handleUnauth(); return; }
        setFetchError(err instanceof Error ? err.message : 'Failed to load user');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSaveGroups() {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateUserAccessGroups(user.id, selectedGroupIds);
      setUser(updated);
      setMessage('Access groups updated.');
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(status: UserStatus) {
    if (!user) return;
    try {
      const updated = await updateUserStatus(user.id, status);
      setUser((prev) => (prev ? { ...prev, status: updated.status, approvedAt: updated.approvedAt } : prev));
      setMessage(`Account status set to ${STATUS_LABELS[status]}.`);
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
      setMessage(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  return (
    <>
      <AdminTopbar back={{ to: '/admin/users', label: '← Users' }} />

      <div className="admin-posts-page">
        {loading && (
          <div className="spinner-wrap">
            <div className="spinner" />
            <span className="spinner-label">Loading user...</span>
          </div>
        )}

        {!loading && fetchError && (
          <div className="error-banner">
            <span className="error-banner__text">{fetchError}</span>
          </div>
        )}

        {!loading && user && (
          <>
            <div className="admin-page-header">
              <div>
                <h1 className="admin-page-title">{user.username}</h1>
                <p className="admin-page-subtitle">{user.email}</p>
              </div>
              <span className={`badge ${STATUS_BADGE[user.status]}`} style={{ fontSize: 13 }}>
                {STATUS_LABELS[user.status]}
              </span>
            </div>

            {message && (
              <div className="callout-note" style={{ marginBottom: 20 }}>{message}</div>
            )}

            <div className="user-detail-grid">
              <section className="user-detail-panel">
                <h2 className="user-detail-panel__title">Account Status</h2>
                <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                  Role: <strong>{user.role}</strong>
                  {user.approvedAt && (
                    <> · Approved {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(user.approvedAt))}</>
                  )}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {user.status === 'PENDING' && (
                    <>
                      <button className="btn btn--accent btn--sm" onClick={() => handleStatus('ACTIVE')}>Approve</button>
                      <button className="btn btn--danger-ghost btn--sm" onClick={() => handleStatus('REJECTED')}>Reject</button>
                    </>
                  )}
                  {user.status === 'ACTIVE' && (
                    <button className="btn btn--danger-ghost btn--sm" onClick={() => handleStatus('SUSPENDED')}>Suspend</button>
                  )}
                  {(user.status === 'SUSPENDED' || user.status === 'REJECTED') && (
                    <button className="btn btn--ghost btn--sm" onClick={() => handleStatus('ACTIVE')}>Reactivate</button>
                  )}
                </div>
              </section>

              <section className="user-detail-panel">
                <h2 className="user-detail-panel__title">Access Groups</h2>
                {allGroups.length === 0 ? (
                  <p className="private-access-panel__empty">
                    No access groups yet — create one under Admin → Access Groups.
                  </p>
                ) : (
                  <div className="checkbox-list">
                    {allGroups.map((group) => (
                      <label key={group.id} className="checkbox-list__item">
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.includes(group.id)}
                          onChange={(e) =>
                            setSelectedGroupIds((prev) =>
                              e.target.checked ? [...prev, group.id] : prev.filter((gid) => gid !== group.id)
                            )
                          }
                        />
                        {group.name}
                      </label>
                    ))}
                  </div>
                )}
                <button className="btn btn--accent btn--sm" style={{ marginTop: 12 }} onClick={handleSaveGroups} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Access Groups'}
                </button>
              </section>

              <section className="user-detail-panel">
                <h2 className="user-detail-panel__title">Direct Post Access</h2>
                {user.directPostAccess.length === 0 ? (
                  <p className="private-access-panel__empty">
                    None — grant exceptions from a post&apos;s edit screen (Visibility → Specific Users).
                  </p>
                ) : (
                  <ul className="user-detail-post-list">
                    {user.directPostAccess.map((p) => (
                      <li key={p.id}>
                        <Link to={`/posts/${p.slug}`} target="_blank" rel="noreferrer">{p.title}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}
