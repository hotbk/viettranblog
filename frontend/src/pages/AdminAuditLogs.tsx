import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAuditLogs, UnauthorizedError } from '../api';
import type { AuditLogEntry } from '../types';
import { logout } from '../auth';
import AdminTopbar from '../components/AdminTopbar';

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export default function AdminAuditLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function handleLogout() { logout(); navigate('/admin/login'); }

  useEffect(() => {
    fetchAuditLogs()
      .then(setLogs)
      .catch((err) => {
        if (err instanceof UnauthorizedError) { handleLogout(); return; }
        setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <AdminTopbar active="auditLogs" />

      <div className="admin-posts-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Audit Logs</h1>
            <p className="admin-page-subtitle">Most recent 200 admin/security actions.</p>
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
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">📜</div>
            <p className="empty-state__title">No activity yet</p>
          </div>
        )}

        {!loading && !error && logs.length > 0 && (
          <div className="posts-table-wrap">
            <table className="posts-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                  <th>Actor</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td><span className="badge badge--admin">{log.action}</span></td>
                    <td style={{ fontSize: 13 }}>{log.targetType} #{log.targetId}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{log.metadata ?? '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                      {log.actorUserId != null ? `#${log.actorUserId}` : 'system'}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{formatDate(log.createdAt)}</td>
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
