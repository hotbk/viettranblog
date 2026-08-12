import { useState } from 'react';
import { Link } from 'react-router-dom';
import { registerMember } from '../api';
import MemberNav from '../components/MemberNav';

export default function MemberRegister() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function validate(): string | null {
    if (username.trim().length < 3) return 'Username must be at least 3 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format';
    if (password.length < 8) return 'Password must be at least 8 characters';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      await registerMember(username.trim(), email.trim(), password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <MemberNav guest />

      <div className="admin-login-wrap">
        <div className="admin-login-card">
          {done ? (
            <>
              <h1 className="admin-login-title">Registration received</h1>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24 }}>
                Your account is pending admin approval. You'll be able to sign in once it's approved.
              </p>
              <Link to="/member/login" className="btn btn--primary" style={{ width: '100%', display: 'block', textAlign: 'center' }}>
                Go to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="admin-login-title">Create a member account</h1>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24 }}>
                New accounts require admin approval before you can access private articles or exams.
              </p>

              {error && (
                <div className="error-banner" style={{ marginBottom: 20 }}>
                  <span className="error-banner__text">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="field" style={{ marginBottom: 16 }}>
                  <label className="field__label" htmlFor="reg-username">Username</label>
                  <input
                    id="reg-username"
                    className="field__input"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="field" style={{ marginBottom: 16 }}>
                  <label className="field__label" htmlFor="reg-email">Email</label>
                  <input
                    id="reg-email"
                    className="field__input"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="field" style={{ marginBottom: 24 }}>
                  <label className="field__label" htmlFor="reg-password">Password</label>
                  <input
                    id="reg-password"
                    className="field__input"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </form>

              <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--color-text-muted)' }}>
                Already have an account?{' '}
                <Link to="/member/login" style={{ color: 'var(--color-slate)', fontWeight: 500 }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
