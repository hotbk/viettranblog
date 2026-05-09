import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../auth';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(username, password);
      navigate('/admin/posts');
    } catch {
      setError('Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <div className="admin-login-logo">VT</div>
          <h1>viettran Blog</h1>
          <p>Admin Panel &mdash; sign in to continue</p>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field__label field__label--required" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="field__input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
              placeholder="Enter your username"
            />
          </div>

          <div className="field">
            <label className="field__label field__label--required" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="field__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="error-banner">
              <span className="error-banner__text">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn--primary btn--full"
            style={{ marginTop: 4 }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-text-muted)' }}>
          <Link to="/" style={{ color: 'var(--color-slate)', fontWeight: 500 }}>
            &larr; Back to blog
          </Link>
        </p>
      </div>
    </div>
  );
}
