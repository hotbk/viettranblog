const MEMBER_TOKEN_KEY = 'member_token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function memberLogin(username: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error('Invalid username or password');
  }

  const data = await response.json();
  const payload = decodeJwtPayload(data.token);
  if (!payload || payload['role'] !== 'MEMBER') {
    throw new Error('This account does not have member access');
  }

  localStorage.setItem(MEMBER_TOKEN_KEY, data.token);
}

export function memberLogout(): void {
  localStorage.removeItem(MEMBER_TOKEN_KEY);
}

export function getMemberToken(): string | null {
  return localStorage.getItem(MEMBER_TOKEN_KEY);
}

export function isMemberAuthenticated(): boolean {
  const token = getMemberToken();
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  return payload?.['role'] === 'MEMBER';
}

export function memberAuthHeader(): Record<string, string> {
  const token = getMemberToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
