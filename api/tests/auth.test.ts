import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestEnv } from './harness.ts';
import { extractSessionCookie, clearedSessionCookie } from './cookies.ts';

const env = new TestEnv();

// A password strong enough to pass zxcvbn score >= 3.
const STRONG_PASSWORD = 'correct-horse-battery-staple-92';

const newUser = (over: Partial<Record<string, string>> = {}) => ({
  forename: 'Ada',
  surname: 'Lovelace',
  username: 'ada-lovelace',
  email: 'ada@example.com',
  password: STRONG_PASSWORD,
  role: 'AUTOBIOGRAPHER',
  ...over,
});

/** Registers a user via the and returns the session cookie. */
async function register(over: Partial<Record<string, string>> = {}) {
  const res = await env.app.inject({
    method: 'POST',
    url: '/v1/users',
    payload: newUser(over),
    headers: { 'x-forwarded-for': '10.0.0.1' },
  });
  return { res, cookie: extractSessionCookie(res) };
}

function login(
  email: string,
  password: string,
  ip = '10.0.0.1',
  cookie?: string,
) {
  return env.app.inject({
    method: 'POST',
    url: '/v1/sessions',
    payload: { email, password },
    headers: {
      'x-forwarded-for': ip,
      ...(cookie ? { cookie } : {}),
    },
  });
}

before(() => env.start());
after(() => env.stop());
beforeEach(() => env.reset());

describe('login', () => {
  test('succeeds with correct credentials and returns the user', async () => {
    await register();
    const res = await login('ada@example.com', STRONG_PASSWORD);

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.email, 'ada@example.com');
    assert.equal(body.password, undefined, 'password must never be serialized');
    assert.ok(extractSessionCookie(res), 'a session cookie should be set');
  });

  test('rejects a wrong password with 401', async () => {
    await register();
    const res = await login('ada@example.com', 'wrong-password-here-123');
    assert.equal(res.statusCode, 401);
  });

  test('rejects an unknown email with 401', async () => {
    const res = await login('nobody@example.com', STRONG_PASSWORD);
    assert.equal(res.statusCode, 401);
  });
});

describe('lockout', () => {
  test('locks the account after 5 failed attempts', async () => {
    await register();

    for (let i = 0; i < 5; i++) {
      const res = await login('ada@example.com', 'wrong-password-here-123');
      assert.equal(res.statusCode, 401, `attempt ${i + 1} should fail with 401`);
    }

    const locked = await login('ada@example.com', STRONG_PASSWORD);
    assert.equal(locked.statusCode, 401);

    const attempts = await env.app.redis.get(`${env.redisPrefix}failed_login:ada@example.com`);
    assert.ok(Number(attempts) >= 5, 'failure counter should be at the lock threshold');
  });

  test('a successful login before the threshold clears the failure counter', async () => {
    await register();

    for (let i = 0; i < 3; i++) {
      await login('ada@example.com', 'wrong-password-here-123');
    }

    const ok = await login('ada@example.com', STRONG_PASSWORD);
    assert.equal(ok.statusCode, 200);

    const counter = await env.app.redis.get(`${env.redisPrefix}failed_login:ada@example.com`);
    assert.equal(counter, null, 'counter should be deleted after a successful login');
  });
});

describe('session regeneration (fixation hardening)', () => {
  test('the session id rotates when logging in on an already-authenticated session', async () => {
    await register();

    const first = await login('ada@example.com', STRONG_PASSWORD);
    const firstCookie = extractSessionCookie(first);
    assert.equal(first.statusCode, 200);
    assert.ok(firstCookie, 'first login should set a session cookie');

    const second = await login('ada@example.com', STRONG_PASSWORD, '10.0.0.1', firstCookie);
    const secondCookie = extractSessionCookie(second);

    assert.equal(second.statusCode, 200);
    assert.ok(secondCookie, 'second login should set a session cookie');
    assert.notEqual(
      firstCookie,
      secondCookie,
      'session id must rotate on re-login to prevent fixation',
    );
  });
});

describe('logout', () => {
  test('destroys the session and clears the cookie', async () => {
    await register();
    const loggedIn = await login('ada@example.com', STRONG_PASSWORD);
    const cookie = extractSessionCookie(loggedIn);

    const res = await env.app.inject({
      method: 'DELETE',
      url: '/v1/sessions',
      headers: { cookie: cookie!, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 204);
    assert.ok(clearedSessionCookie(res), 'logout should clear the session cookie');

    const after = await env.app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: { cookie: cookie!, 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(after.statusCode, 401, 'destroyed session must not authenticate');
  });
});
