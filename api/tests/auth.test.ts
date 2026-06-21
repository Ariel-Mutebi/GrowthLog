import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestEnv } from './harness.ts';
import { extractSessionCookie, clearedSessionCookie } from './cookies.ts';

const env = new TestEnv();
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

/**
 * Registers a user via POST users/
 * @param over overrides over the default account details
 * @param ip rate limiting necessitates rotation of the IP for multi-user tests
 */
async function register(
  over: Partial<Record<string, string>> = {},
  ip = '10.0.0.1',
) {
  const res = await env.app.inject({
    method: 'POST',
    url: '/v1/users',
    payload: newUser(over),
    headers: { 'x-forwarded-for': ip },
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

describe('per-email lockout', () => {
  test('locks the email after 5 failed attempts, regardless of IP', async () => {
    await register();

    // Rotate IP each attempt so the per-IP rate limiter never reaches its
    // threshold; only the per-email failed_login counter accumulates.
    for (let i = 0; i < 5; i++) {
      const res = await login(
        'ada@example.com',
        'wrong-password-here-123',
        `10.0.0.${i + 1}`,
      );
      assert.equal(res.statusCode, 401, `attempt ${i + 1} should fail with 401 (bad credentials)`);
    }

    // 6th attempt, fresh IP, correct password: the email is now locked, so
    // credentials are never checked — lockout short-circuits with 423.
    const locked = await login('ada@example.com', STRONG_PASSWORD, '10.0.0.6');
    assert.equal(locked.statusCode, 423, 'a locked email returns 423 even with the right password');

    const attempts = await env.app.redis.get(`${env.redisPrefix}failed_login:ada@example.com`);
    assert.ok(Number(attempts) >= 5, 'the per-email failure counter should be at the lock threshold');
  });

  test('the lockout is scoped to the email, not the IP', async () => {
    await register();

    const graceReg = await register(
      {
        email: 'grace@example.com',
        username: 'grace-hopper',
      },
      '10.0.1.1',
    );
    assert.equal(graceReg.res.statusCode, 201, 'grace registered');

    // Lock ada from a spread of IPs.
    for (let i = 0; i < 5; i++) {
      await login('ada@example.com', 'wrong-password-here-123', `10.0.0.${i + 1}`);
    }
    const adaLocked = await login('ada@example.com', STRONG_PASSWORD, '10.0.0.6');
    assert.equal(adaLocked.statusCode, 423, 'ada should be locked');

    const graceOk = await login('grace@example.com', STRONG_PASSWORD, '10.0.0.1');
    assert.equal(graceOk.statusCode, 200, 'grace logs in from an IP ada was locked on — lockout is per-email, not per-IP');
  });
});

describe('per-IP rate limiting', () => {
  test('throttles the IP after 5 requests, regardless of email', async () => {
    // Rotate the email each request so no single failed_login counter reaches
    // the lockout threshold; only the per-IP limiter accumulates.
    for (let i = 0; i < 5; i++) {
      const res = await login(
        `nobody-${i}@example.com`,
        'wrong-password-here-123',
        '10.0.0.1',
      );
      assert.equal(res.statusCode, 401, `request ${i + 1} should reach auth and fail with 401`);
    }

    // 6th request from the same IP: the limiter trips before passport runs,
    // so the email and credentials are irrelevant.
    const throttled = await login('nobody-6@example.com', STRONG_PASSWORD, '10.0.0.1');
    assert.equal(throttled.statusCode, 429, 'the 6th request from one IP is rate-limited');
  });

  test('the throttle is scoped to the IP, not the email', async () => {
    // Exhaust the limiter on one IP with rotating emails.
    for (let i = 0; i < 5; i++) {
      await login(`spammer-${i}@example.com`, 'wrong-password-here-123', '10.0.0.1');
    }
    const throttled = await login('spammer-6@example.com', 'wrong-password-here-123', '10.0.0.1');
    assert.equal(throttled.statusCode, 429, 'the saturated IP is throttled');

    // A different IP, even reusing an already-tried email, is not throttled.
    const otherIp = await login('spammer-0@example.com', 'wrong-password-here-123', '10.0.0.2');
    assert.equal(otherIp.statusCode, 401, 'a fresh IP still reaches auth (401, not 429)');
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
