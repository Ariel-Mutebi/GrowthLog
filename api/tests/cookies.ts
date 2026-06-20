import type { LightMyRequestResponse } from 'fastify';

/**
 * Extracts the session cookie from a response's Set-Cookie header so it can be
 * replayed on subsequent requests within the same test. app.inject() does not
 * persist cookies across calls, so the session must be threaded manually.
 */
export function extractSessionCookie(res: LightMyRequestResponse): string | undefined {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return undefined;

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const session = cookies.find((c) => c.startsWith('sessionId='));
  if (!session) return undefined;

  // Return just the `name=value` pair, dropping attributes (Path, HttpOnly, ...).
  return session.split(';')[0];
}

/**
 * Returns true if the response cleared the session cookie (Max-Age=0 / Expires in
 * the past), i.e. logout or account deletion took effect.
 */
export function clearedSessionCookie(res: LightMyRequestResponse): boolean {
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) return false;

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.some(
    (c) => c.startsWith('sessionId=') && /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c),
  );
}
