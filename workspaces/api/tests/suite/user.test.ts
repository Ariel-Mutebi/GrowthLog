import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import type { Device } from '../device.js';
import {
  ADA_LOGIN,
  SESSION,
  STRONG_PASSWORD,
  WRONG_PASSWORD,
  newUser,
  profileWithSession,
  register,
  sessionOf,
  signedInDevice,
} from './helpers/user.js';

const GRACE = {
  forename: 'Grace',
  surname: 'Hopper',
  username: 'grace-hopper',
  email: 'grace@example.com',
};
const WEAK_PASSWORD = 'passwordpassword';
const NEW_PASSWORD = 'purple-monkey-dishwasher-telescope-58';
const confirmPassword = { currentPassword: STRONG_PASSWORD };

/** A valid registration body with one field left out. */
function withoutField(field: string) {
  return Object.fromEntries(Object.entries(newUser()).filter(([key]) => key !== field));
}

const userRow = (env: TestEnv, id: string) => env.app.prisma.user.findUniqueOrThrow({ where: { id } });

async function deleteAccount(device: Device) {
  const res = await device.delete('/api/users', confirmPassword);
  expect(res.statusCode, `account deletion failed: ${res.body}`).toBe(200);
}

const search = (device: Device, params: Record<string, string>) =>
  device.get(`/api/users/search?${new URLSearchParams(params).toString()}`);

const usernamesOf = (res: LightMyRequestResponse) =>
  (res.json().users as { username: string }[]).map((user) => user.username);

/**
 * Registers people one after another (so createdAt is strictly increasing),
 * each from their own device. Returns their ids in registration order.
 */
async function registerPeople(env: TestEnv, people: [forename: string, surname: string][]) {
  const ids: string[] = [];
  for (const [forename, surname] of people) {
    const handle = `${forename}-${surname}`.toLowerCase();
    ids.push(
      await register(env.device(), { forename, surname, username: handle, email: `${handle}@example.com` }),
    );
  }
  return ids;
}

describe('registration', () => {
  test('creates the account, returns it without secrets, and signs the user in', async ({ env }) => {
    const device = env.device();

    const res = await device.post('/api/users', newUser());

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      forename: 'Ada',
      surname: 'Lovelace',
      username: 'ada-lovelace',
      email: ADA_LOGIN.email,
      avatarKey: null,
    });
    expect(res.json().id).toEqual(expect.any(String));
    expect(res.json()).not.toHaveProperty('password');
    expect(res.json()).not.toHaveProperty('deletedAt');

    expect(device.cookies.has(SESSION), 'registration should open a session').toBe(true);
    const me = await device.get('/api/users');
    expect(me.statusCode).toBe(200);
    expect(me.json().id).toBe(res.json().id);
  });

  test('stores a bcrypt hash, never the plaintext password', async ({ env }) => {
    const id = await register(env.device());

    const user = await userRow(env, id);

    expect(user.password).not.toBe(STRONG_PASSWORD);
    expect(user.password).toMatch(/^\$2[aby]\$10\$/);
  });

  test('derives a lowercase username from the name when none is given', async ({ env }) => {
    const res = await env.device().post('/api/users', withoutField('username'));

    expect(res.statusCode).toBe(201);
    expect(res.json().username).toBe('ada-lovelace');
  });

  test('adds a numeric suffix when the derived username is taken', async ({ env }) => {
    const first = await env.device().post('/api/users', withoutField('username'));
    const second = await env
      .device()
      .post('/api/users', { ...withoutField('username'), email: GRACE.email });

    expect(first.json().username).toBe('ada-lovelace');
    expect(second.statusCode).toBe(201);
    expect(second.json().username).toBe('ada-lovelace-1');
  });

  test('keeps an explicitly chosen username', async ({ env }) => {
    const res = await env.device().post('/api/users', newUser({ username: 'countess-of-lovelace' }));

    expect(res.statusCode).toBe(201);
    expect(res.json().username).toBe('countess-of-lovelace');
  });

  test('rejects a taken username with 409', async ({ env }) => {
    await register(env.device());

    const res = await env.device().post('/api/users', newUser({ email: GRACE.email }));

    expect(res.statusCode).toBe(409);
    expect(res.json().message).toBe('This username or email is already in use');
    expect(await env.app.prisma.user.count()).toBe(1);
  });

  test('rejects a taken email with 409', async ({ env }) => {
    await register(env.device());

    const res = await env.device().post('/api/users', newUser({ username: GRACE.username }));

    expect(res.statusCode).toBe(409);
    expect(await env.app.prisma.user.count()).toBe(1);
  });

  test('rejects a taken email with 409 when the username is derived', async ({ env }) => {
    await register(env.device());

    // Different names, so only the email can conflict.
    const res = await env
      .device()
      .post('/api/users', { ...withoutField('username'), forename: GRACE.forename, surname: GRACE.surname });

    expect(res.statusCode).toBe(409);
    expect(res.json().message).toBe('This email is already in use');
  });

  test('rejects a weak password with 400 and creates no account', async ({ env }) => {
    const res = await env.device().post('/api/users', newUser({ password: WEAK_PASSWORD }));

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('This password is too weak');
    expect(Array.isArray(res.json().suggestions)).toBe(true);
    expect(await env.app.prisma.user.count()).toBe(0);
  });

  test('rejects a malformed email with 400', async ({ env }) => {
    const res = await env.device().post('/api/users', newUser({ email: 'not-an-email' }));

    expect(res.statusCode).toBe(400);
    expect(await env.app.prisma.user.count()).toBe(0);
  });

  test.for(['forename', 'surname', 'email', 'password'])('rejects a body without %s with 400', async (field, { env }) => {
    const res = await env.device().post('/api/users', withoutField(field));

    expect(res.statusCode).toBe(400);
    expect(await env.app.prisma.user.count()).toBe(0);
  });

  test('allows one successful registration per IP per day', async ({ env }) => {
    const first = env.device();
    await register(first);

    const second = await env.device(first.ip).post('/api/users', newUser(GRACE));

    expect(second.statusCode).toBe(429);
    expect(Number(second.headers['retry-after'])).toBeGreaterThan(0);
    expect(await env.app.prisma.user.count()).toBe(1);
  });

  test('a rejected weak password does not use up the daily allowance', async ({ env }) => {
    const device = env.device();

    const weak = await device.post('/api/users', newUser({ password: WEAK_PASSWORD }));
    expect(weak.statusCode).toBe(400);

    const retry = await device.post('/api/users', newUser());
    expect(retry.statusCode, 'the retry from the same IP is allowed').toBe(201);
  });

  test('a rejected duplicate does not use up the daily allowance', async ({ env }) => {
    await register(env.device());
    const device = env.device();

    const duplicate = await device.post('/api/users', newUser());
    expect(duplicate.statusCode).toBe(409);

    const retry = await device.post('/api/users', newUser(GRACE));
    expect(retry.statusCode, 'the retry from the same IP is allowed').toBe(201);
  });

  test('parallel registrations from one IP create only one account', async ({ env }) => {
    const { ip } = env.device();

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        env.device(ip).post('/api/users', newUser({ email: `person-${i}@example.com`, username: `person-${i}` })),
      ),
    );

    const statuses = responses.map((r) => r.statusCode).sort();
    expect(statuses).toEqual([201, 429, 429, 429, 429]);
    expect(await env.app.prisma.user.count()).toBe(1);
  });

  test('ignores fields a client must not set', async ({ env }) => {
    const res = await env.device().post('/api/users', {
      ...newUser(),
      createdAt: '2000-01-01T00:00:00.000Z',
      deletedAt: '2000-01-01T00:00:00.000Z',
      avatarId: randomUUID(),
    });

    expect(res.statusCode).toBe(201);
    const user = await userRow(env, res.json().id);
    expect(user.createdAt.getFullYear()).toBeGreaterThan(2000);
    expect(user.deletedAt).toBeNull();
    expect(user.avatarId).toBeNull();
  });
});

describe('GET /api/users (self)', () => {
  test('requires a session', async ({ env }) => {
    const res = await env.device().get('/api/users');
    expect(res.statusCode).toBe(401);
  });

  test('returns the signed-in user without secrets', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    const res = await device.get('/api/users');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id,
      email: ADA_LOGIN.email,
      username: 'ada-lovelace',
      forename: 'Ada',
      surname: 'Lovelace',
      avatarKey: null,
    });
    expect(res.json()).not.toHaveProperty('password');
  });
});

describe('GET /api/users/:userId', () => {
  test('is public and returns only public fields', async ({ env }) => {
    const id = await register(env.device());

    const res = await env.device().get(`/api/users/${id}`);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id,
      forename: 'Ada',
      surname: 'Lovelace',
      username: 'ada-lovelace',
      avatarKey: null,
    });
    expect(res.json()).not.toHaveProperty('email');
    expect(res.json()).not.toHaveProperty('password');
  });

  test('returns 404 for an unknown user', async ({ env }) => {
    const res = await env.device().get(`/api/users/${randomUUID()}`);

    expect(res.statusCode).toBe(404);
    expect(res.json().message).toBe('The requested user could not be found');
  });

  test('returns 404 for a soft-deleted user', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    await deleteAccount(device);

    const res = await env.device().get(`/api/users/${id}`);

    expect(res.statusCode, 'a deleted account must not stay publicly visible').toBe(404);
  });
});

describe('GET /api/users/search', () => {
  test('matches forename, surname and username, case-insensitively', async ({ env }) => {
    await register(env.device());
    await register(env.device(), GRACE);
    const device = env.device();

    for (const name of ['ADA', 'lovelace', 'ada-love']) {
      const res = await search(device, { name });
      expect(res.statusCode, `searching for ${name}`).toBe(200);
      expect(usernamesOf(res), `searching for ${name}`).toEqual(['ada-lovelace']);
    }
  });

  test('requires every search term to match', async ({ env }) => {
    await register(env.device());
    await register(env.device(), GRACE);
    const device = env.device();

    const both = await search(device, { name: 'ada lovelace' });
    expect(usernamesOf(both)).toEqual(['ada-lovelace']);

    // Each term matches a different person, so nobody matches both.
    const mixed = await search(device, { name: 'ada hopper' });
    expect(mixed.statusCode).toBe(404);
  });

  test('returns only public fields', async ({ env }) => {
    await register(env.device());

    const res = await search(env.device(), { name: 'ada' });

    expect(res.statusCode).toBe(200);
    const [user] = res.json().users;
    expect(user).toMatchObject({ username: 'ada-lovelace', avatarKey: null });
    expect(user).not.toHaveProperty('email');
    expect(user).not.toHaveProperty('password');
  });

  test('returns 404 when nothing matches', async ({ env }) => {
    await register(env.device());

    const res = await search(env.device(), { name: 'nobody-by-that-name' });

    expect(res.statusCode).toBe(404);
    expect(res.json().message).toBe('No user matching that criteria was found');
  });

  test('requires a name or an interest', async ({ env }) => {
    const res = await env.device().get('/api/users/search');
    expect(res.statusCode).toBe(400);
  });

  test.for(['0', '51'])('rejects limit=%s with 400', async (limit, { env }) => {
    const res = await search(env.device(), { name: 'ada', limit });
    expect(res.statusCode).toBe(400);
  });

  test('excludes soft-deleted users', async ({ env }) => {
    await register(env.device(), {
      forename: 'Visible',
      surname: 'Person',
      username: 'visible-person',
      email: 'visible@example.com',
    });
    const { device: gone } = await signedInDevice(env, {
      forename: 'Gone',
      surname: 'Person',
      username: 'gone-person',
      email: 'gone@example.com',
    });
    await deleteAccount(gone);

    const res = await search(env.device(), { name: 'person' });

    expect(res.statusCode).toBe(200);
    expect(usernamesOf(res)).toEqual(['visible-person']);
  });

  test('paginates with a cursor, newest first', async ({ env }) => {
    const ids = await registerPeople(env, [
      ['Ann', 'Pager'],
      ['Ben', 'Pager'],
      ['Cy', 'Pager'],
    ]);
    const device = env.device();

    const page1 = await search(device, { name: 'pager', limit: '2' });
    expect(page1.statusCode).toBe(200);
    expect(page1.json().users.map((u: { id: string }) => u.id)).toEqual([ids[2], ids[1]]);
    expect(page1.json().nextCursor, 'a further page exists').toEqual(expect.any(String));

    const page2 = await search(device, { name: 'pager', limit: '2', cursor: page1.json().nextCursor });
    expect(page2.statusCode).toBe(200);
    expect(page2.json().users.map((u: { id: string }) => u.id)).toEqual([ids[0]]);
    expect(page2.json().nextCursor, 'this is the last page').toBeNull();
  });
});

describe('PATCH /api/users', () => {
  test('requires a session', async ({ env }) => {
    const res = await env.device().patch('/api/users', { forename: 'Augusta' });
    expect(res.statusCode).toBe(401);
  });

  test('updates profile fields without asking for the password', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    const res = await device.patch('/api/users', { forename: 'Augusta', bio: 'Analyst and metaphysician' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, forename: 'Augusta', bio: 'Analyst and metaphysician' });
    expect(res.json()).not.toHaveProperty('password');

    const me = await device.get('/api/users');
    expect(me.json()).toMatchObject({ forename: 'Augusta', surname: 'Lovelace' });
  });

  test('requires the current password to change the email', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    const missing = await device.patch('/api/users', { email: GRACE.email });
    const wrong = await device.patch('/api/users', { email: GRACE.email, currentPassword: WRONG_PASSWORD });

    expect(missing.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect((await userRow(env, id)).email).toBe(ADA_LOGIN.email);
  });

  test('changes the email when the current password is right', async ({ env }) => {
    const { device } = await signedInDevice(env);

    const res = await device.patch('/api/users', { email: GRACE.email, ...confirmPassword });

    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe(GRACE.email);

    const newLogin = await env.device().post('/api/sessions', { email: GRACE.email, password: STRONG_PASSWORD });
    expect(newLogin.statusCode, 'the new email logs in').toBe(200);
    const oldLogin = await env.device().post('/api/sessions', ADA_LOGIN);
    expect(oldLogin.statusCode, 'the old email no longer does').toBe(401);
  });

  test('requires the current password to change the password', async ({ env }) => {
    const { device } = await signedInDevice(env);

    const res = await device.patch('/api/users', { password: NEW_PASSWORD });

    expect(res.statusCode).toBe(401);
    const login = await env.device().post('/api/sessions', ADA_LOGIN);
    expect(login.statusCode, 'the old password still works').toBe(200);
  });

  test('changes the password and stores it hashed', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    const res = await device.patch('/api/users', { password: NEW_PASSWORD, ...confirmPassword });

    expect(res.statusCode).toBe(200);
    expect((await userRow(env, id)).password).not.toBe(NEW_PASSWORD);

    const newLogin = await env.device().post('/api/sessions', { ...ADA_LOGIN, password: NEW_PASSWORD });
    expect(newLogin.statusCode, 'the new password logs in').toBe(200);
    const oldLogin = await env.device().post('/api/sessions', ADA_LOGIN);
    expect(oldLogin.statusCode, 'the old password no longer does').toBe(401);
  });

  test('rejects a weak new password with 400 and keeps the old one', async ({ env }) => {
    const { device } = await signedInDevice(env);

    const res = await device.patch('/api/users', { password: WEAK_PASSWORD, ...confirmPassword });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('Your desired new password is too weak');
    const login = await env.device().post('/api/sessions', ADA_LOGIN);
    expect(login.statusCode).toBe(200);
  });

  test('rejects a username that is already taken with 409', async ({ env }) => {
    await register(env.device(), GRACE);
    const { device, id } = await signedInDevice(env);

    const res = await device.patch('/api/users', { username: GRACE.username });

    expect(res.statusCode).toBe(409);
    expect((await userRow(env, id)).username).toBe('ada-lovelace');
  });

  test('rejects an email that is already taken with 409', async ({ env }) => {
    await register(env.device(), GRACE);
    const { device, id } = await signedInDevice(env);

    const res = await device.patch('/api/users', { email: GRACE.email, ...confirmPassword });

    expect(res.statusCode).toBe(409);
    expect((await userRow(env, id)).email).toBe(ADA_LOGIN.email);
  });

  test('ignores fields a client must not set', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const before = await userRow(env, id);

    const res = await device.patch('/api/users', {
      forename: 'Augusta',
      createdAt: '2000-01-01T00:00:00.000Z',
      deletedAt: '2000-01-01T00:00:00.000Z',
      avatarId: randomUUID(),
    });

    expect(res.statusCode).toBe(200);
    const after = await userRow(env, id);
    expect(after.forename).toBe('Augusta');
    expect(after.createdAt).toEqual(before.createdAt);
    expect(after.deletedAt).toBeNull();
    expect(after.avatarId).toBeNull();
  });

  test.todo('revokes the account\'s other sessions after a password change');
});

describe('DELETE /api/users', () => {
  test('requires a session', async ({ env }) => {
    const res = await env.device().delete('/api/users', confirmPassword);
    expect(res.statusCode).toBe(401);
  });

  test('requires the current password in the body', async ({ env }) => {
    const { device } = await signedInDevice(env);

    const res = await device.delete('/api/users');

    expect(res.statusCode).toBe(400);
  });

  test('rejects a wrong password and leaves the account and session intact', async ({ env }) => {
    const { device, id } = await signedInDevice(env);

    const res = await device.delete('/api/users', { currentPassword: WRONG_PASSWORD });

    expect(res.statusCode).toBe(401);
    expect((await userRow(env, id)).deletedAt).toBeNull();
    expect((await device.get('/api/users')).statusCode, 'still signed in').toBe(200);
  });

  test('soft-deletes the account, destroys the session and clears the cookie', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    const sessionId = sessionOf(device);

    const res = await device.delete('/api/users', confirmPassword);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id, email: ADA_LOGIN.email });
    expect(res.json()).not.toHaveProperty('password');

    const user = await userRow(env, id);
    expect(user.deletedAt, 'the row is kept, only marked deleted').not.toBeNull();

    expect(device.cookies.has(SESSION), 'the cookie is cleared').toBe(false);
    // Replaying the old id proves the session is gone server-side, not just forgotten by the client.
    expect((await profileWithSession(env, sessionId)).statusCode).toBe(401);
  });

  test('keeps the email and username reserved while the account is recoverable', async ({ env }) => {
    const { device } = await signedInDevice(env);
    await deleteAccount(device);

    const res = await env.device().post('/api/users', newUser());

    expect(res.statusCode).toBe(409);
  });
});
