import assert from 'node:assert/strict';
import type { TestEnv } from '../../harness.ts';
import { extractSessionCookie } from '../../cookies.ts';

export const STRONG_PASSWORD = 'correct-horse-battery-staple-92';

export const newUser = (over: Partial<Record<string, string>> = {}) => ({
  forename: 'Ada',
  surname: 'Lovelace',
  username: 'ada-lovelace',
  email: 'ada@example.com',
  password: STRONG_PASSWORD,
  role: 'AUTOBIOGRAPHER',
  ...over,
});

export async function register(
  env: TestEnv,
  over: Partial<Record<string, string>> = {},
  ip = '10.0.0.1',
) {
  const res = await env.app.inject({
    method: 'POST',
    url: '/v1/users',
    payload: newUser(over),
    headers: { 'x-forwarded-for': ip },
  });
  return { res, id: res.json().id, cookie: extractSessionCookie(res) };
}

export async function login(
  env: TestEnv,
  email: string,
  password: string,
  ip = '10.0.0.1',
) {
  const res = await env.app.inject({
    method: 'POST',
    url: '/v1/sessions',
    payload: { email, password },
    headers: { 'x-forwarded-for': ip },
  });
  return { res, cookie: extractSessionCookie(res) };
}

/** Registers and immediately logs in, returning the user id and session cookie. */
export async function authenticatedSession(
  env: TestEnv,
  over: Partial<Record<string, string>> = {},
  ip = '10.0.0.1',
) {
  const { id } = await register(env, over, ip);
  const { cookie } = await login(env, over.email ?? 'ada@example.com', STRONG_PASSWORD, ip);
  assert.ok(cookie, 'session cookie required for authenticated helpers');
  return { id, cookie: cookie! };
}
