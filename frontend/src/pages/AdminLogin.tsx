import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../auth';
import ThemeToggle from '../components/ThemeToggle';

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
      <div className="admin-login-page__theme-toggle">
        <ThemeToggle />
      </div>
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <svg
            className="admin-login-logo"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <mask id="t2b-login-mask">
              <rect width="100" height="100" rx="24" fill="#fff" />
              <path
                d="M9.33,18.48 A22,22 0 1,1 41,45.05 L8,96 L52,96"
                fill="none"
                stroke="#000"
                strokeWidth="24"
                strokeLinecap="round"
                strokeLinejoin="round"
                transform="translate(33.3,14) scale(0.76) translate(-8,-4)"
              />
              <path
                d="M16,32 V68 M16,32 H24 M16,68 H24"
                fill="none"
                stroke="#000"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M84,32 V68 M84,32 H76 M84,68 H76"
                fill="none"
                stroke="#000"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </mask>
            <rect width="100" height="100" rx="24" fill="var(--color-accent)" mask="url(#t2b-login-mask)" />
          </svg>
          <h1>TECH2BLOGS</h1>
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
