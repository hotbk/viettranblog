import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchAdminAccessRequests, approveAccessRequest, rejectAccessRequest, fetchAccessGroups,
  UnauthorizedError,
} from '../api';
import type { AccessRequest, AccessGroup } from '../types';
import { logout } from '../auth';
import AdminTopbar from '../components/AdminTopbar';

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export default function AdminAccessRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [groupChoice, setGroupChoice] = useState<Record<number, number | ''>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  function handleUnauth() { logout(); navigate('/admin/login'); }

  function load() {
    Promise.all([fetchAdminAccessRequests('PENDING'), fetchAccessGroups()])
      .then(([reqs, grps]) => { setRequests(reqs); setGroups(grps); })
      .catch((err) => {
        if (err instanceof UnauthorizedError) { handleUnauth(); return; }
        setError(err instanceof Error ? err.message : 'Failed to load access requests');
      })
      .finally(() => setLoading(false));
  }

  function retry() {
    setLoading(true);
    setError(null);
    load();
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleApproveDirect(req: AccessRequest) {
    setBusyId(req.id);
    try {
      await approveAccessRequest(req.id, 'DIRECT');
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setBusyId(null);
    }
  }

  async function handleApproveGroup(req: AccessRequest) {
    const groupId = groupChoice[req.id];
    if (!groupId) return;
    setBusyId(req.id);
    try {
      await approveAccessRequest(req.id, 'GROUP', Number(groupId));
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(req: AccessRequest) {
    setBusyId(req.id);
    try {
      await rejectAccessRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AdminTopbar active="accessRequests" />

      <div className="admin-posts-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Access Requests</h1>
            <p className="admin-page-subtitle">
              {loading ? 'Loading...' : `${requests.length} pending request${requests.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {loading && (
          <div className="spinner-wrap">
            <div className="spinner" />
            <span className="spinner-label">Loading...</span>
          </div>
        )}

        {!loading && error && (
          <div className="error-banner">
            <span className="error-banner__text">{error}</span>
            <button className="error-banner__retry" onClick={retry}>Retry</button>
          </div>
        )}

        {!loading && !error && requests.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">📬</div>
            <p className="empty-state__title">No pending requests</p>
            <p className="empty-state__desc">Access requests from members will show up here.</p>
          </div>
        )}

        {!loading && !error && requests.length > 0 && (
          <div className="posts-table-wrap">
            <table className="posts-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Post</th>
                  <th>Message</th>
                  <th>Requested</th>
                  <th style={{ width: 340 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.username}</td>
                    <td><div className="post-title-cell__title">{r.postTitle}</div></td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13, maxWidth: 200 }}>{r.message || '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{formatDate(r.createdAt)}</td>
                    <td>
                      <div className="table-actions" style={{ flexWrap: 'wrap' }}>
                        <button
                          className="btn btn--accent btn--sm"
                          disabled={busyId === r.id}
                          onClick={() => handleApproveDirect(r)}
                        >
                          Grant Direct
                        </button>
                        <select
                          className="form-input form-input--sm"
                          value={groupChoice[r.id] ?? ''}
                          onChange={(e) => setGroupChoice((prev) => ({ ...prev, [r.id]: e.target.value ? Number(e.target.value) : '' }))}
                        >
                          <option value="">Via group...</option>
                          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <button
                          className="btn btn--ghost btn--sm"
                          disabled={busyId === r.id || !groupChoice[r.id]}
                          onClick={() => handleApproveGroup(r)}
                        >
                          Grant
                        </button>
                        <button
                          className="btn btn--danger-ghost btn--sm"
                          disabled={busyId === r.id}
                          onClick={() => handleReject(r)}
                        >
                          Reject
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
    </>
  );
}
