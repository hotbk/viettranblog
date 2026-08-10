/**
 * Decodes a JWT's payload without verifying the signature — safe for reading
 * claims (username, role) client-side to drive UI, never for trusting the
 * token's authenticity (the backend still verifies that on every request).
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
