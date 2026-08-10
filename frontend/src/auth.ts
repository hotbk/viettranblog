import { getMemberToken } from './memberAuth';
import { decodeJwtPayload } from './jwt';

const TOKEN_KEY = 'admin_token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (response.status === 403) {
    throw new Error('Tài khoản này không có quyền đăng nhập admin (role: READER)');
  }
  if (!response.ok) {
    throw new Error('Sai tên đăng nhập hoặc mật khẩu');
  }

  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.token);
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export function authHeader(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Username of the logged-in admin, read from the JWT `sub` claim, or null if not logged in. */
export function getUsername(): string | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return typeof payload?.sub === 'string' ? payload.sub : null;
}

/**
 * For the *public* reading surface (post list/detail, comments, series) —
 * these calls need to identify whoever is logged in, admin or member, so the
 * backend can evaluate private-post access. Tries the admin token first,
 * then the member token. Without this, the backend never sees who's logged
 * in on public pages and every private-post read looks anonymous.
 */
export function publicAuthHeader(): Record<string, string> {
  const adminToken = getToken();
  if (adminToken) return { Authorization: `Bearer ${adminToken}` };
  const memberToken = getMemberToken();
  if (memberToken) return { Authorization: `Bearer ${memberToken}` };
  return {};
}
