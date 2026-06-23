import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestEnv } from '../harness.ts';
import { extractSessionCookie, clearedSessionCookie } from '../cookies.ts';
import { STRONG_PASSWORD, register, login, authenticatedSession } from './helpers/user.ts';

const env = new TestEnv();

before(() => env.start());
after(() => env.stop());
beforeEach(() => env.reset());

describe('login', () => {
  test('succeeds with correct credentials and returns the user', async () => {
    await register(env);
    const { res } = await login(env, 'ada@example.com', STRONG_PASSWORD);

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.email, 'ada@example.com');
    assert.equal(body.password, undefined, 'password must never be serialized');
    assert.ok(extractSessionCookie(res), 'a session cookie should be set');
  });

  test('rejects a wrong password with 401', async () => {
    await register(env);
    const { res } = await login(env, 'ada@example.com', 'wrong-password-here-123');
    assert.equal(res.statusCode, 401);
  });

  test('rejects an unknown email with 401', async () => {
    const { res } = await login(env, 'nobody@example.com', STRONG_PASSWORD);
    assert.equal(res.statusCode, 401);
  });
});

describe('per-email lockout', () => {
  test('locks the email after 5 failed attempts, regardless of IP', async () => {
    await register(env);

    // Rotate IP each attempt so the per-IP rate limiter never reaches its
    // threshold; only the per-email failed_login counter accumulates.
    for (let i = 0; i < 5; i++) {
      const { res } = await login(env, 'ada@example.com', 'wrong-password-here-123', `10.0.0.${i + 1}`);
      assert.equal(res.statusCode, 401, `attempt ${i + 1} should fail with 401 (bad credentials)`);
    }

    // 6th attempt, fresh IP, correct password: the email is now locked, so
    // credentials are never checked — lockout short-circuits with 423.
    const { res: locked } = await login(env, 'ada@example.com', STRONG_PASSWORD, '10.0.0.6');
    assert.equal(locked.statusCode, 423, 'a locked email returns 423 even with the right password');

    const attempts = await env.app.redis.get(`${env.redisPrefix}failed_login:ada@example.com`);
    assert.ok(Number(attempts) >= 5, 'the per-email failure counter should be at the lock threshold');
  });

  test('the lockout is scoped to the email, not the IP', async () => {
    await register(env);
    const { res: graceReg } = await register(
      env,
      { email: 'grace@example.com', username: 'grace-hopper' },
      '10.0.1.1',
    );
    assert.equal(graceReg.statusCode, 201, 'grace registered');

    // Lock ada from a spread of IPs.
    for (let i = 0; i < 5; i++) {
      await login(env, 'ada@example.com', 'wrong-password-here-123', `10.0.0.${i + 1}`);
    }
    const { res: adaLocked } = await login(env, 'ada@example.com', STRONG_PASSWORD, '10.0.0.6');
    assert.equal(adaLocked.statusCode, 423, 'ada should be locked');

    const { res: graceOk } = await login(env, 'grace@example.com', STRONG_PASSWORD, '10.0.0.1');
    assert.equal(graceOk.statusCode, 200, 'grace logs in from an IP ada was locked on — lockout is per-email, not per-IP');
  });
});

describe('per-IP rate limiting', () => {
  test('throttles the IP after 5 requests, regardless of email', async () => {
    // Rotate the email each request so no single failed_login counter reaches
    // the lockout threshold; only the per-IP limiter accumulates.
    for (let i = 0; i < 5; i++) {
      const { res } = await login(env, `nobody-${i}@example.com`, 'wrong-password-here-123', '10.0.0.1');
      assert.equal(res.statusCode, 401, `request ${i + 1} should reach auth and fail with 401`);
    }

    // 6th request from the same IP: the limiter trips before passport runs,
    // so the email and credentials are irrelevant.
    const { res: throttled } = await login(env, 'nobody-6@example.com', STRONG_PASSWORD, '10.0.0.1');
    assert.equal(throttled.statusCode, 429, 'the 6th request from one IP is rate-limited');
  });

  test('the throttle is scoped to the IP, not the email', async () => {
    for (let i = 0; i < 5; i++) {
      await login(env, `spammer-${i}@example.com`, 'wrong-password-here-123', '10.0.0.1');
    }
    const { res: throttled } = await login(env, 'spammer-6@example.com', 'wrong-password-here-123', '10.0.0.1');
    assert.equal(throttled.statusCode, 429, 'the saturated IP is throttled');

    const { res: otherIp } = await login(env, 'spammer-0@example.com', 'wrong-password-here-123', '10.0.0.2');
    assert.equal(otherIp.statusCode, 401, 'a fresh IP still reaches auth (401, not 429)');
  });
});

describe('session regeneration (fixation hardening)', () => {
  test('the session id rotates when logging in on an already-authenticated session', async () => {
    const { cookie: firstCookie } = await authenticatedSession(env);

    // Log in again on the existing session.
    const { res: second } = await login(env, 'ada@example.com', STRONG_PASSWORD);
    const secondCookie = extractSessionCookie(second);

    assert.equal(second.statusCode, 200);
    assert.ok(secondCookie, 'second login should set a session cookie');
    assert.notEqual(firstCookie, secondCookie, 'session id must rotate on re-login to prevent fixation');
  });
});

describe('soft-delete restore', () => {
  test('re-login within 7 days restores the account and opens a session', async () => {
    const { cookie: firstCookie } = await authenticatedSession(env);

    await env.app.inject({
      method: 'DELETE',
      url: '/v1/users',
      payload: { currentPassword: STRONG_PASSWORD },
      headers: { cookie: firstCookie, 'x-forwarded-for': '10.0.0.1' },
    });

    // Re-login immediately — well within the 7-day window.
    const { res, cookie } = await login(env, 'ada@example.com', STRONG_PASSWORD);
    assert.equal(res.statusCode, 200, 're-login should succeed within the recovery window');
    assert.ok(cookie, 'a new session should be established on restore');

    // The restored session must be able to authenticate.
    const profile = await env.app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(profile.statusCode, 200, 'restored account must authenticate');
    assert.equal(profile.json().email, 'ada@example.com');
  });

  test('re-login after 7 days is rejected with 401', async () => {
    const { id } = await authenticatedSession(env);

    // Backdate deletedAt to 8 days ago directly in the database, simulating
    // a deletion that has passed the recovery window.
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await env.app.prisma.user.update({
      where: { id },
      data: { deletedAt: eightDaysAgo },
    });

    const { res } = await login(env, 'ada@example.com', STRONG_PASSWORD);
    assert.equal(res.statusCode, 401, 'expired soft-delete should be permanently rejected');
  });
});

describe('logout', () => {
  test('destroys the session and clears the cookie', async () => {
    const { cookie } = await authenticatedSession(env);

    const res = await env.app.inject({
      method: 'DELETE',
      url: '/v1/sessions',
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 204);
    assert.ok(clearedSessionCookie(res), 'logout should clear the session cookie');

    const after = await env.app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(after.statusCode, 401, 'destroyed session must not authenticate');
  });
});
