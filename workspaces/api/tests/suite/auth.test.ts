import { describe, expect } from 'vitest';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import type { Device } from '../device.js';
import {
  ADA_LOGIN,
  SESSION,
  STRONG_PASSWORD,
  WRONG_PASSWORD,
  register,
  signedInDevice,
} from './helpers/user.js';

const wrongPassword = { ...ADA_LOGIN, password: WRONG_PASSWORD };
const confirmPassword = { currentPassword: STRONG_PASSWORD };

const failedLoginKey = (env: TestEnv, email: string) => `${env.redisPrefix}failed_login:${email}`;

/** The device's session id; throws if it has none, so it doubles as an assertion. */
function sessionOf(device: Device) {
  const id = device.cookies.get(SESSION);
  if (!id) throw new Error('device has no session cookie');
  return id;
}

/** GET /api/users from a fresh device holding only the given session id. */
function profileWithSession(env: TestEnv, sessionId: string) {
  const device = env.device();
  device.cookies.set(SESSION, sessionId);
  return device.get('/api/users');
}

/** Simulates a deletion that happened `days` ago. */
const backdateDeletion = (env: TestEnv, id: string, days: number) =>
  env.app.prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
  });

/**
 * Fails `count` logins for `email`, each from a fresh device with its own IP,
 * so the per-IP limiter never trips and only the per-email counter accumulates.
 * Returns the IPs used.
 */
async function failLogins(env: TestEnv, email: string, count: number) {
  const ips: string[] = [];
  for (let i = 0; i < count; i++) {
    const device = env.device();
    ips.push(device.ip);
    const res = await device.post('/api/sessions', { email, password: WRONG_PASSWORD });
    expect(res.statusCode, `attempt ${i + 1} should be a plain bad-credentials 401`).toBe(401);
  }
  return ips;
}

describe('login', () => {
  test('succeeds with correct credentials and returns the user', async ({ env }) => {
    await register(env.device());

    // A separate device, so this is a clean login and not a re-login on a live session.
    const res = await env.device().post('/api/sessions', ADA_LOGIN);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      email: ADA_LOGIN.email,
      username: 'ada-lovelace',
      forename: 'Ada',
      surname: 'Lovelace',
    });
    expect(res.json()).not.toHaveProperty('password');
    expect(res.json()).not.toHaveProperty('deletedAt');

    const session = res.cookies.find((c) => c.name === SESSION);
    expect(session, 'a session cookie should be set').toBeDefined();
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite?.toLowerCase()).toBe('lax');
  });

  test('rejects a wrong password with 401', async ({ env }) => {
    await register(env.device());
    const res = await env.device().post('/api/sessions', wrongPassword);
    expect(res.statusCode).toBe(401);
  });

  test('rejects an unknown email with 401', async ({ env }) => {
    const res = await env.device().post('/api/sessions', { ...ADA_LOGIN, email: 'nobody@example.com' });
    expect(res.statusCode).toBe(401);
  });

  test('gives identical errors for a wrong password and an unknown email', async ({ env }) => {
    await register(env.device());

    const wrongPw = await env.device().post('/api/sessions', wrongPassword);
    const unknownEmail = await env
      .device()
      .post('/api/sessions', { ...wrongPassword, email: 'nobody@example.com' });

    expect(wrongPw.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPw.json(), 'responses must not reveal which emails are registered').toEqual(
      unknownEmail.json(),
    );
  });

  test('rejects a body without a password with 400 and does not count as a failed attempt', async ({ env }) => {
    await register(env.device());

    const res = await env.device().post('/api/sessions', { email: ADA_LOGIN.email });

    expect(res.statusCode).toBe(400);
    expect(await env.app.redis.get(failedLoginKey(env, ADA_LOGIN.email))).toBeNull();
  });
});

describe('per-email lockout', () => {
  test('locks the email after 5 failed attempts, regardless of IP', async ({ env }) => {
    await register(env.device());
    await failLogins(env, ADA_LOGIN.email, 5);

    // Fresh IP, correct password: lockout short-circuits before credentials are checked.
    const locked = await env.device().post('/api/sessions', ADA_LOGIN);

    expect(locked.statusCode, 'a locked email returns 423 even with the right password').toBe(423);
    expect(locked.json().error).toBe('Locked');
    expect(Number(await env.app.redis.get(failedLoginKey(env, ADA_LOGIN.email)))).toBe(6);
  });

  test('locks unknown emails the same way, so lockout does not reveal which accounts exist', async ({ env }) => {
    await failLogins(env, 'nobody@example.com', 5);

    const res = await env.device().post('/api/sessions', { ...ADA_LOGIN, email: 'nobody@example.com' });
    expect(res.statusCode).toBe(423);
  });

  test('the failure counter expires on its own within 15 minutes', async ({ env }) => {
    await register(env.device());
    await failLogins(env, ADA_LOGIN.email, 1);

    const ttl = await env.app.redis.ttl(failedLoginKey(env, ADA_LOGIN.email));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(15 * 60);
  });

  test('a successful login resets the failure counter', async ({ env }) => {
    await register(env.device());
    await failLogins(env, ADA_LOGIN.email, 4);

    const ok = await env.device().post('/api/sessions', ADA_LOGIN);
    expect(ok.statusCode).toBe(200);
    expect(await env.app.redis.get(failedLoginKey(env, ADA_LOGIN.email))).toBeNull();

    // Without the reset, the 2nd of these would be attempt #6 and return 423.
    await failLogins(env, ADA_LOGIN.email, 4);
    const stillOpen = await env.device().post('/api/sessions', ADA_LOGIN);
    expect(stillOpen.statusCode).toBe(200);
  });

  test('the lockout is scoped to the email, not the IP', async ({ env }) => {
    const grace = { email: 'grace@example.com', password: STRONG_PASSWORD };
    await register(env.device());
    await register(env.device(), { email: grace.email, username: 'grace-hopper' });

    const adaIps = await failLogins(env, ADA_LOGIN.email, 5);
    const adaLocked = await env.device().post('/api/sessions', ADA_LOGIN);
    expect(adaLocked.statusCode, 'ada should be locked').toBe(423);

    // Grace logs in from an IP that ada's failures came from.
    const graceOk = await env.device(adaIps[0]).post('/api/sessions', grace);
    expect(graceOk.statusCode).toBe(200);
  });

  test('parallel guesses cannot exceed the attempt limit', async ({ env }) => {
    await register(env.device());

    // 20 simultaneous wrong guesses, each from its own IP so only the per-email counter is in play.
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => env.device().post('/api/sessions', wrongPassword)),
    );

    const statuses = responses.map((r) => r.statusCode);
    expect(statuses.filter((s) => s === 401), 'only 5 guesses may reach the password check').toHaveLength(5);
    expect(statuses.filter((s) => s === 423), 'the rest are locked out').toHaveLength(15);
  });
});

describe('per-IP rate limiting', () => {
  test('throttles the IP after 5 requests, regardless of email', async ({ env }) => {
    const device = env.device();

    // Rotate the email so no single failed_login counter reaches the lockout threshold.
    for (let i = 0; i < 5; i++) {
      const res = await device.post('/api/sessions', { ...wrongPassword, email: `nobody-${i}@example.com` });
      expect(res.statusCode, `request ${i + 1} should reach auth and fail with 401`).toBe(401);
    }

    // The limiter trips before passport runs, so credentials are irrelevant.
    const throttled = await device.post('/api/sessions', { ...ADA_LOGIN, email: 'nobody-6@example.com' });
    expect(throttled.statusCode).toBe(429);
  });

  test('the throttle is scoped to the IP, not the email', async ({ env }) => {
    const spammer = env.device();
    for (let i = 0; i < 5; i++) {
      await spammer.post('/api/sessions', { ...wrongPassword, email: `spammer-${i}@example.com` });
    }
    const throttled = await spammer.post('/api/sessions', { ...wrongPassword, email: 'spammer-6@example.com' });
    expect(throttled.statusCode, 'the saturated IP is throttled').toBe(429);

    const otherIp = await env
      .device()
      .post('/api/sessions', { ...wrongPassword, email: 'spammer-0@example.com' });
    expect(otherIp.statusCode, 'a fresh IP still reaches auth (401, not 429)').toBe(401);
  });
});

describe('session', () => {
  test('authenticates later requests, and rejects missing or forged cookies', async ({ env }) => {
    const { device } = await signedInDevice(env);

    const me = await device.get('/api/users');
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe(ADA_LOGIN.email);

    expect((await env.device().get('/api/users')).statusCode, 'no cookie').toBe(401);
    expect((await profileWithSession(env, 'forged-session-id')).statusCode, 'forged cookie').toBe(401);
  });

  describe('regeneration (fixation hardening)', () => {
    test('logging in on an already-authenticated session rotates the id and kills the old one', async ({ env }) => {
      const { device } = await signedInDevice(env);
      const before = sessionOf(device);

      // Same device, so the existing session cookie is sent with this login.
      const res = await device.post('/api/sessions', ADA_LOGIN);
      expect(res.statusCode).toBe(200);

      expect(sessionOf(device), 'session id must rotate on re-login').not.toBe(before);
      expect((await profileWithSession(env, before)).statusCode, 'old id must be dead').toBe(401);
      expect((await device.get('/api/users')).statusCode, 'new id works').toBe(200);
    });
  });
});

describe('soft-delete restore', () => {
  test('re-login within the recovery window restores the account and opens a session', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const deleted = await device.delete('/api/users', confirmPassword);
    expect(deleted.statusCode).toBeLessThan(300);

    const restored = env.device();
    const res = await restored.post('/api/sessions', ADA_LOGIN);

    expect(res.statusCode, 're-login should succeed within the recovery window').toBe(200);
    expect(restored.cookies.has(SESSION), 'a new session should be established').toBe(true);
    expect((await restored.get('/api/users')).statusCode, 'restored account must authenticate').toBe(200);

    const user = await env.app.prisma.user.findUniqueOrThrow({ where: { id } });
    expect(user.deletedAt).toBeNull();
  });

  test('still restores a deletion that is 6 days old', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    await device.delete('/api/users', confirmPassword);
    await backdateDeletion(env, id, 6);

    const res = await env.device().post('/api/sessions', ADA_LOGIN);
    expect(res.statusCode).toBe(200);
  });

  test('rejects re-login 8 days after deletion with 401 and leaves the account deleted', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    await device.delete('/api/users', confirmPassword);
    await backdateDeletion(env, id, 8);

    const res = await env.device().post('/api/sessions', ADA_LOGIN);

    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe('Account permanently deleted');
    const user = await env.app.prisma.user.findUniqueOrThrow({ where: { id } });
    expect(user.deletedAt, 'an expired account must not be restored').not.toBeNull();
  });

  test('deleting the account on one device invalidates the session on the other device', async ({ env }) => {
    const { device: deviceA } = await signedInDevice(env);
    const deviceB = env.device();
    await deviceB.post('/api/sessions', ADA_LOGIN);
    expect((await deviceB.get('/api/users')).statusCode).toBe(200);

    await deviceA.delete('/api/users', confirmPassword);

    expect(deviceA.cookies.has(SESSION), 'the deleting device has its cookie cleared').toBe(false);
    expect(
      (await deviceB.get('/api/users')).statusCode,
      'the other device must not keep a working session after the account is deleted',
    ).toBe(401);
  });
});

describe('logout', () => {
  test('destroys the session server-side and clears the cookie', async ({ env }) => {
    const { device } = await signedInDevice(env);
    const sessionId = sessionOf(device);

    const res = await device.delete('/api/sessions');

    expect(res.statusCode).toBe(204);
    expect(device.cookies.has(SESSION), 'logout should clear the session cookie').toBe(false);
    // Replaying the old id proves the session is gone server-side, not just forgotten by the client.
    expect((await profileWithSession(env, sessionId)).statusCode).toBe(401);
  });

  test('requires a session', async ({ env }) => {
    const res = await env.device().delete('/api/sessions');
    expect(res.statusCode).toBe(401);
  });

  test('logging out on one device leaves the other devices signed in', async ({ env }) => {
    const { device: deviceA } = await signedInDevice(env);
    const deviceB = env.device();
    await deviceB.post('/api/sessions', ADA_LOGIN);

    await deviceA.delete('/api/sessions');

    expect((await deviceA.get('/api/users')).statusCode).toBe(401);
    expect((await deviceB.get('/api/users')).statusCode).toBe(200);
  });
});
