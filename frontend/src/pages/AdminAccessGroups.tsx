import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchAccessGroups, createAccessGroup, updateAccessGroup, deleteAccessGroup,
  UnauthorizedError,
} from '../api';
import type { AccessGroupRequestDto } from '../api';
import type { AccessGroup } from '../types';
import { logout } from '../auth';
import AdminTopbar from '../components/AdminTopbar';
import { slugify } from '../slugify';

const EMPTY_FORM: AccessGroupRequestDto = { name: '', slug: '', description: '', enabled: true };

export default function AdminAccessGroups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState<AccessGroupRequestDto>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleUnauth() { logout(); navigate('/admin/login'); }

  function load() {
    fetchAccessGroups()
      .then(setGroups)
      .catch((err) => {
        if (err instanceof UnauthorizedError) { handleUnauth(); return; }
        setError(err instanceof Error ? err.message : 'Failed to load access groups');
      })
      .finally(() => setLoading(false));
  }

  function retry() {
    setLoading(true);
    setError(null);
    load();
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setFormError(null);
    setShowForm(true);
  }

  function startEdit(group: AccessGroup) {
    setEditingId(group.id);
    setForm({ name: group.name, slug: group.slug, description: group.description ?? '', enabled: group.enabled });
    setSlugTouched(true);
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    if (!form.slug.trim()) { setFormError('Slug is required'); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingId != null) {
        const updated = await updateAccessGroup(editingId, form);
        setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      } else {
        const created = await createAccessGroup(form);
        setGroups((prev) => [created, ...prev]);
      }
      setShowForm(false);
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
      setFormError(err instanceof Error ? err.message : 'Failed to save access group');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(group: AccessGroup) {
    if (!window.confirm(`Delete access group "${group.name}"? Users and posts will lose this grant.`)) return;
    setGroups((prev) => prev.filter((g) => g.id !== group.id));
    try {
      await deleteAccessGroup(group.id);
    } catch (err) {
      load();
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
      setError(err instanceof Error ? err.message : 'Failed to delete access group');
    }
  }

  async function handleToggleEnabled(group: AccessGroup) {
    try {
      const updated = await updateAccessGroup(group.id, {
        name: group.name, slug: group.slug, description: group.description ?? '', enabled: !group.enabled,
      });
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch (err) {
      if (err instanceof UnauthorizedError) { handleUnauth(); return; }
    }
  }

  return (
    <>
      <AdminTopbar active="accessGroups" />

      <div className="admin-posts-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Private Access Groups</h1>
            <p className="admin-page-subtitle">
              {loading ? 'Loading...' : `${groups.length} group${groups.length !== 1 ? 's' : ''} total`}
            </p>
          </div>
          <button className="btn btn--accent" onClick={startCreate} disabled={showForm}>+ New Group</button>
        </div>

        {showForm && (
          <div className="post-form-wrap">
            <form onSubmit={handleSubmit} noValidate>
              <div className="post-form-header">
                <h2 className="post-form-title">{editingId != null ? 'Edit Access Group' : 'New Access Group'}</h2>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowForm(false)}>Cancel</button>
              </div>

              {formError && (
                <div className="error-banner" style={{ marginBottom: 16 }}>
                  <span className="error-banner__text">{formError}</span>
                </div>
              )}

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="ag-name">Name</label>
                  <input
                    id="ag-name"
                    className="form-input"
                    value={form.name}
                    placeholder="e.g. Database Pro"
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ag-slug">Slug</label>
                  <input
                    id="ag-slug"
                    className="form-input"
                    value={form.slug}
                    placeholder="database-pro"
                    onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: e.target.value })); }}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" htmlFor="ag-desc">Description</label>
                  <textarea
                    id="ag-desc"
                    className="form-input form-textarea"
                    rows={2}
                    value={form.description}
                    placeholder="Các bài chuyên sâu về Database."
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    />
                    Enabled
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="submit" className="btn btn--accent" disabled={submitting}>
                  {submitting ? 'Saving...' : editingId != null ? 'Save changes' : 'Create group'}
                </button>
              </div>
            </form>
          </div>
        )}

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

        {!loading && !error && groups.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">🔒</div>
            <p className="empty-state__title">No access groups yet</p>
            <p className="empty-state__desc">Create a group to bundle private posts and grant them to many users at once.</p>
            <button className="btn btn--accent" onClick={startCreate} style={{ marginTop: 16 }}>+ New Group</button>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <div className="posts-table-wrap">
            <table className="posts-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Users</th>
                  <th>Posts</th>
                  <th>Status</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td><div className="post-title-cell__title">{g.name}</div></td>
                    <td><div className="post-title-cell__slug">{g.slug}</div></td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{g.userCount}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{g.postCount}</td>
                    <td>
                      <span className={`badge ${g.enabled ? 'badge--published' : 'badge--draft'}`}>
                        {g.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn--ghost btn--sm" onClick={() => startEdit(g)}>Edit</button>
                        <button className="btn btn--ghost btn--sm" onClick={() => handleToggleEnabled(g)}>
                          {g.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn btn--danger-ghost btn--sm" onClick={() => handleDelete(g)}>Delete</button>
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
