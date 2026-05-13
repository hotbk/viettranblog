import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { memberLogin } from '../memberAuth';
import NavBrand from '../components/NavBrand';

export default function MemberLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await memberLogin(username, password);
      navigate('/member/exams', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <nav className="site-nav" style={{ position: 'static', marginBottom: 0 }}>
        <div className="site-nav__inner">
          <NavBrand />
          <div className="site-nav__links">
            <Link to="/" className="site-nav__link">Home</Link>
          </div>
        </div>
      </nav>

      <div className="admin-login-wrap">
        <div className="admin-login-card">
          <h1 className="admin-login-title">Member Login</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24 }}>
            Sign in to access and take exams.
          </p>

          {error && (
            <div className="error-banner" style={{ marginBottom: 20 }}>
              <span className="error-banner__text">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field" style={{ marginBottom: 16 }}>
              <label className="field__label" htmlFor="ml-username">Username</label>
              <input
                id="ml-username"
                className="field__input"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 24 }}>
              <label className="field__label" htmlFor="ml-password">Password</label>
              <input
                id="ml-password"
                className="field__input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
