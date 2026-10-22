import { describe, expect } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import type { LightMyRequestResponse } from 'fastify';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import type { Device } from '../device.js';
import {
  ADA_LOGIN,
  GRACE,
  SESSION,
  STRONG_PASSWORD,
  deleteAccount,
  newUser,
  profileWithSession,
  register,
  sessionOf,
  signedInDevice,
} from './helpers/user.js';

const WEAK_PASSWORD = 'passwordpassword';
const DAY_SECONDS = 24 * 3600;

/** The exact set of fields anyone may see about a user. */
const PUBLIC_KEYS = ['avatarKey', 'bio', 'createdAt', 'forename', 'id', 'surname', 'username'];
const PERSONAL_KEYS = [...PUBLIC_KEYS, 'email'].sort();
const keysOf = (value: object) => Object.keys(value).sort();

/** A valid registration body with one field left out. */
function withoutField(field: string) {
  return Object.fromEntries(Object.entries(newUser()).filter(([key]) => key !== field));
}

const userRow = (env: TestEnv, id: string) => env.app.prisma.user.findUniqueOrThrow({ where: { id } });
const registrationSlot = (env: TestEnv, ip: string) => `${env.redisPrefix}registration:${ip}`;

const search = (device: Device, params: Record<string, string>) =>
  device.get(`/api/users/search?${new URLSearchParams(params).toString()}`);

const usernamesOf = (res: LightMyRequestResponse) =>
  (res.json().users as { username: string }[]).map((user) => user.username);

const idsOf = (res: LightMyRequestResponse) => (res.json().users as { id: string }[]).map((user) => user.id);

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

/** Inserts users straight into the database, for cases that would be too slow or too exact to register. */
function seedUsers(
  env: TestEnv,
  rows: { username: string; forename?: string; surname?: string; createdAt?: Date }[],
) {
  return env.app.prisma.user.createMany({
    data: rows.map((row) => ({
      forename: row.forename ?? 'Seed',
      surname: row.surname ?? 'Person',
      username: row.username,
      email: `${row.username}@seed.example.com`,
      password: 'not-a-real-hash',
      ...(row.createdAt && { createdAt: row.createdAt }),
    })),
  });
}

/** Follows nextCursor until the last page; returns the ids on each page. */
async function collectPages(device: Device, params: Record<string, string>) {
  const pages: string[][] = [];
  let cursor: string | null = null;
  do {
    const res: LightMyRequestResponse = await search(device, cursor ? { ...params, cursor } : params);
    expect(res.statusCode, res.body).toBe(200);
    pages.push(idsOf(res));
    cursor = res.json().nextCursor;
  } while (cursor && pages.length < 20);
  return pages;
}

describe('POST /api/users (registration)', () => {
  describe('success', () => {
    test('creates the account, returns it without secrets, and signs the user in', async ({ env }) => {
      const device = env.device();

      const res = await device.post('/api/users', newUser());

      expect(res.statusCode, res.body).toBe(201);
      expect(res.json()).toMatchObject({
        forename: 'Ada',
        surname: 'Lovelace',
        username: 'ada-lovelace',
        email: ADA_LOGIN.email,
        avatarKey: null,
        bio: null,
      });
      expect(res.json().id).toEqual(expect.any(String));
      expect(keysOf(res.json()), 'exactly the personal fields, nothing else').toEqual(PERSONAL_KEYS);

      const session = res.cookies.find((c) => c.name === SESSION);
      expect(session, 'registration should open a session').toBeDefined();
      expect(session?.httpOnly).toBe(true);
      expect(session?.sameSite?.toLowerCase()).toBe('lax');

      const me = await device.get('/api/me');
      expect(me.statusCode).toBe(200);
      expect(me.json().id).toBe(res.json().id);
    });

    test('the new credentials work for a later login', async ({ env }) => {
      await register(env.device());

      const res = await env.device().post('/api/sessions', ADA_LOGIN);

      expect(res.statusCode).toBe(200);
    });

    test('stores a bcrypt hash, never the plaintext password', async ({ env }) => {
      const id = await register(env.device());

      const user = await userRow(env, id);

      expect(user.password).not.toBe(STRONG_PASSWORD);
      expect(user.password).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    test('stores an optional bio, and leaves it null when omitted', async ({ env }) => {
      const withBio = await env.device().post('/api/users', newUser({ bio: 'Analyst and metaphysician' }));
      const without = await env.device().post('/api/users', newUser(GRACE));

      expect(withBio.json().bio).toBe('Analyst and metaphysician');
      expect(without.json().bio).toBeNull();
    });

    test('keeps an explicitly chosen username', async ({ env }) => {
      const res = await env.device().post('/api/users', newUser({ username: 'countess-of-lovelace' }));

      expect(res.statusCode).toBe(201);
      expect(res.json().username).toBe('countess-of-lovelace');
    });

    test('rejects fields a client must not set', async ({ env }) => {
      const res = await env.device().post('/api/users', {
        ...newUser(),
        id: 'attacker-chosen-id',
        createdAt: '2000-01-01T00:00:00.000Z',
        deletedAt: '2000-01-01T00:00:00.000Z',
        emailVerifiedAt: '2000-01-01T00:00:00.000Z',
        sessionsRevokedAt: '2999-01-01T00:00:00.000Z',
      });

      expect(res.statusCode, res.body).toBe(400);
    });

    test('registering on a device that already holds a session issues a fresh session id', async ({ env }) => {
      const { device: ada } = await signedInDevice(env);
      const adaSession = sessionOf(ada);
      const other = env.device(); // its own IP, so the daily allowance is not in the way
      other.cookies.set(SESSION, adaSession);

      const res = await other.post('/api/users', newUser(GRACE));

      expect(res.statusCode, res.body).toBe(201);
      expect(sessionOf(other), 'the session id must rotate on registration').not.toBe(adaSession);
      expect(
        (await profileWithSession(env, adaSession)).statusCode,
        'the pre-registration id must not authenticate the new account',
      ).toBe(401);
    });
  });

  describe('generated usernames', () => {
    test('derives a lowercase slug of the name plus a four-digit suffix when none is given', async ({ env }) => {
      const res = await env.device().post('/api/users', withoutField('username'));

      expect(res.statusCode, res.body).toBe(201);
      expect(res.json().username).toMatch(/^ada-lovelace-\d{4}$/);
      expect(Number(res.json().username.slice(-4))).toBeGreaterThanOrEqual(1000);
    });

    test('registrations with identical names get distinct usernames, even in parallel', async ({ env }) => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          env.device().post('/api/users', { ...withoutField('username'), email: `ada-${i}@example.com` }),
        ),
      );

      expect(responses.map((r) => r.statusCode)).toEqual(Array(5).fill(201));
      expect(new Set(responses.map((r) => r.json().username)).size).toBe(5);
    });

    // Leaves only ada-lovelace-1000..1099 free, so the service must re-roll about 80 times on average.
    test('re-rolls the suffix when the derived username is taken', async ({ env }) => {
      const taken = Array.from({ length: 8900 }, (_, i) => 1100 + i);
      await seedUsers(env, taken.map((n) => ({ username: `ada-lovelace-${n}` })));

      const res = await env.device().post('/api/users', withoutField('username'));

      expect(res.statusCode, res.body).toBe(201);
      expect(res.json().username).toMatch(/^ada-lovelace-10\d{2}$/);
    });

    test.for([
      ['diacritics', 'Zoë', 'Müller'],
      ['an apostrophe', 'Sinéad', 'O\'Connor'],
    ] as const)('derives a clean username from a name with %s', async ([, forename, surname], { env }) => {
      const res = await env.device().post('/api/users', { ...withoutField('username'), forename, surname });

      expect(res.statusCode, res.body).toBe(201);
      expect(res.json().username).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}$/);
    });
  });

  describe('conflicts', () => {
    test('rejects a taken username with 409', async ({ env }) => {
      await register(env.device());

      const res = await env.device().post('/api/users', newUser({ email: GRACE.email }));

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ error: 'Conflict', message: 'This username is already in use' });
      expect(await env.app.prisma.user.count()).toBe(1);
    });

    test('rejects a taken email with 409', async ({ env }) => {
      await register(env.device());

      const res = await env.device().post('/api/users', newUser({ username: GRACE.username }));

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ error: 'Conflict', message: 'This email is already in use' });
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

    test('a soft-deleted account still holds its username and email', async ({ env }) => {
      const { device } = await signedInDevice(env);
      await deleteAccount(device);

      const username = await env.device().post('/api/users', newUser({ email: GRACE.email }));
      const email = await env.device().post('/api/users', newUser({ username: GRACE.username }));

      expect(username.statusCode, 'username stays reserved while recoverable').toBe(409);
      expect(email.statusCode, 'email stays reserved while recoverable').toBe(409);
    });


    test('treats a differently-cased %s as taken', async ({ env }) => {
      await register(env.device());

      const res = await env.device().post('/api/users', newUser({
        email: 'ADA@EXAMPLE.COM',
        username: 'someone-else',
      }));

      expect(res.statusCode, res.body).toBe(409);
      expect(await env.app.prisma.user.count()).toBe(1);
    });

    test('simultaneous registrations for one email create exactly one account', async ({ env }) => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          env.device().post('/api/users', newUser({ username: `person-${i}` })),
        ),
      );

      const statuses = responses.map((r) => r.statusCode).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      expect(await env.app.prisma.user.count()).toBe(1);
    });

    test('simultaneous registrations for one username create exactly one account', async ({ env }) => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          env.device().post('/api/users', newUser({ email: `person-${i}@example.com` })),
        ),
      );

      const statuses = responses.map((r) => r.statusCode).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      expect(await env.app.prisma.user.count()).toBe(1);
    });
  });

  describe('validation', () => {
    test('rejects a weak password with 400, suggestions, and no account', async ({ env }) => {
      const res = await env.device().post('/api/users', newUser({ password: WEAK_PASSWORD }));

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: 'BadRequest', message: 'This password is too weak' });
      const { suggestions } = res.json();
      expect(Array.isArray(suggestions)).toBe(true);
      expect((suggestions as unknown[]).every((s) => typeof s === 'string')).toBe(true);
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
  });

  describe('one account per IP per day', () => {
    test('allows one successful registration per IP, and says when to retry', async ({ env }) => {
      const first = env.device();
      await register(first);

      const second = await env.device(first.ip).post('/api/users', newUser(GRACE));

      expect(second.statusCode).toBe(429);
      expect(second.json()).toMatchObject({
        error: 'RateLimited',
        message: 'Only one account can be registered per IP address per day',
      });
      const retryAfter = Number(second.headers['retry-after']);
      expect(Number.isInteger(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(DAY_SECONDS);
      expect(await env.app.prisma.user.count()).toBe(1);
    });

    test('the allowance is per IP: another IP can still register', async ({ env }) => {
      await register(env.device());

      const res = await env.device().post('/api/users', newUser(GRACE));

      expect(res.statusCode, res.body).toBe(201);
    });

    test('the allowance expires on its own within a day', async ({ env }) => {
      const device = env.device();
      await register(device);

      const ttl = await env.app.redis.ttl(registrationSlot(env, device.ip));

      expect(ttl).toBeGreaterThan(DAY_SECONDS - 60);
      expect(ttl).toBeLessThanOrEqual(DAY_SECONDS);
    });

    test('a rejected weak password does not use up the allowance', async ({ env }) => {
      const device = env.device();

      const weak = await device.post('/api/users', newUser({ password: WEAK_PASSWORD }));
      expect(weak.statusCode).toBe(400);
      expect(await env.app.redis.get(registrationSlot(env, device.ip)), 'the slot is released').toBeNull();

      const retry = await device.post('/api/users', newUser());
      expect(retry.statusCode, 'the retry from the same IP is allowed').toBe(201);
    });

    test('a rejected duplicate does not use up the allowance', async ({ env }) => {
      await register(env.device());
      const device = env.device();

      const duplicate = await device.post('/api/users', newUser());
      expect(duplicate.statusCode).toBe(409);
      expect(await env.app.redis.get(registrationSlot(env, device.ip)), 'the slot is released').toBeNull();

      const retry = await device.post('/api/users', newUser(GRACE));
      expect(retry.statusCode, 'the retry from the same IP is allowed').toBe(201);
    });

    test('a body that fails schema validation never takes the allowance', async ({ env }) => {
      const device = env.device();

      const res = await device.post('/api/users', withoutField('email'));

      expect(res.statusCode).toBe(400);
      expect(await env.app.redis.get(registrationSlot(env, device.ip))).toBeNull();
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
  });
});

describe('GET /api/users/:id', () => {
  test('is public and returns exactly the public fields', async ({ env }) => {
    const id = await register(env.device());

    const res = await env.device().get(`/api/users/${id}`);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id,
      forename: 'Ada',
      surname: 'Lovelace',
      username: 'ada-lovelace',
      avatarKey: null,
      bio: null,
    });
    expect(keysOf(res.json()), 'no email, password or other private field').toEqual(PUBLIC_KEYS);
  });

  test('returns the same thing to a signed-in user', async ({ env }) => {
    const { id } = await signedInDevice(env);
    const { device: viewer } = await signedInDevice(env, GRACE);

    const res = await viewer.get(`/api/users/${id}`);

    expect(res.statusCode).toBe(200);
    expect(keysOf(res.json())).toEqual(PUBLIC_KEYS);
  });

  test('returns 404 for a non-existent user', async ({ env }) => {
    const res = await env.device().get(`/api/users/${createId()}`);
    expect(res.statusCode).toBe(404);
  });

  test('returns 404 for a soft-deleted user, and the profile returns once the account is restored', async ({ env }) => {
    const { device, id } = await signedInDevice(env);
    await deleteAccount(device);

    const hidden = await env.device().get(`/api/users/${id}`);
    expect(hidden.statusCode, 'a deleted account must not stay publicly visible').toBe(404);

    const restored = await env.device().post('/api/sessions', ADA_LOGIN);
    expect(restored.statusCode).toBe(200);

    const visible = await env.device().get(`/api/users/${id}`);
    expect(visible.statusCode, 'visible again after restore').toBe(200);
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

  test('ignores extra whitespace around and between terms', async ({ env }) => {
    await register(env.device());

    const res = await search(env.device(), { name: '   ada     lovelace   ' });

    expect(res.statusCode, res.body).toBe(200);
    expect(usernamesOf(res)).toEqual(['ada-lovelace']);
  });

  test('needs no session, and returns exactly the public fields', async ({ env }) => {
    await register(env.device());

    const res = await search(env.device(), { name: 'ada' });

    expect(res.statusCode).toBe(200);
    const [user] = res.json().users;
    expect(user).toMatchObject({ username: 'ada-lovelace', avatarKey: null });
    expect(keysOf(user), 'no email, password or other private field').toEqual(PUBLIC_KEYS);
  });

  test('returns 404 when nothing matches', async ({ env }) => {
    await register(env.device());

    const res = await search(env.device(), { name: 'nobody-by-that-name' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({
      error: 'NotFound',
      message: 'No user matching that criteria was found',
    });
  });

  test('requires a name or an interest', async ({ env }) => {
    const res = await env.device().get('/api/users/search');
    expect(res.statusCode, '/search must not be mistaken for /:id').toBe(400);
  });

  // A blank name has no terms to filter on, so unless it is rejected `contains: ''` matches every user.
  test.for([
    ['empty', ''],
    ['spaces', '   '],
    ['a tab', '\t'],
  ] as const)('rejects a name that is %s instead of listing everyone', async ([, name], { env }) => {
    await register(env.device());

    const res = await search(env.device(), { name });

    expect([400, 404], `got ${res.statusCode}: ${res.body}`).toContain(res.statusCode);
  });

  // LIKE wildcards in user input must be treated literally, or one request enumerates every account.
  test.for(['%', '_'])('treats %s as a literal character, not a wildcard', async (name, { env }) => {
    await register(env.device());
    await register(env.device(), GRACE);

    const res = await search(env.device(), { name });

    expect(res.statusCode, res.body).toBe(404);
  });

  test.for(['0', '51', 'abc', '1.5', '-3'])('rejects limit=%s with 400', async (limit, { env }) => {
    const res = await search(env.device(), { name: 'ada', limit });
    expect(res.statusCode).toBe(400);
  });

  test('excludes soft-deleted users, and lists them again once restored', async ({ env }) => {
    await register(env.device(), {
      forename: 'Visible',
      surname: 'Person',
      username: 'visible-person',
      email: 'visible@example.com',
    });
    const gone = {
      forename: 'Gone',
      surname: 'Person',
      username: 'gone-person',
      email: 'gone@example.com',
    };
    const { device } = await signedInDevice(env, gone);
    await deleteAccount(device);

    const hidden = await search(env.device(), { name: 'person' });
    expect(hidden.statusCode).toBe(200);
    expect(usernamesOf(hidden)).toEqual(['visible-person']);

    await env.device().post('/api/sessions', { email: gone.email, password: STRONG_PASSWORD });

    const back = await search(env.device(), { name: 'person' });
    expect(usernamesOf(back).sort()).toEqual(['gone-person', 'visible-person']);
  });

  describe('pagination', () => {
    test('pages with a cursor, newest first', async ({ env }) => {
      const ids = await registerPeople(env, [
        ['Ann', 'Pager'],
        ['Ben', 'Pager'],
        ['Cy', 'Pager'],
      ]);
      const device = env.device();

      const page1 = await search(device, { name: 'pager', limit: '2' });
      expect(page1.statusCode).toBe(200);
      expect(idsOf(page1)).toEqual([ids[2], ids[1]]);
      expect(page1.json().nextCursor, 'a further page exists').toEqual(expect.any(String));

      const page2 = await search(device, { name: 'pager', limit: '2', cursor: page1.json().nextCursor });
      expect(page2.statusCode).toBe(200);
      expect(idsOf(page2)).toEqual([ids[0]]);
      expect(page2.json().nextCursor, 'this is the last page').toBeNull();
    });

    test('a result set that exactly fills the last page has no cursor and no empty page after it', async ({ env }) => {
      await registerPeople(env, [
        ['Ann', 'Exact'],
        ['Ben', 'Exact'],
      ]);

      const res = await search(env.device(), { name: 'exact', limit: '2' });

      expect(res.statusCode).toBe(200);
      expect(res.json().users).toHaveLength(2);
      expect(res.json().nextCursor).toBeNull();
    });

    test('defaults to 20 per page and accepts a limit of 1 and of 50', async ({ env }) => {
      const base = Date.UTC(2026, 0, 1);
      await seedUsers(
        env,
        Array.from({ length: 25 }, (_, i) => ({
          username: `bulk-${String(i).padStart(2, '0')}`,
          createdAt: new Date(base + i * 1000),
        })),
      );
      const device = env.device();

      const first = await search(device, { name: 'seed' });
      expect(first.json().users).toHaveLength(20);
      expect(first.json().nextCursor).toEqual(expect.any(String));
      const second = await search(device, { name: 'seed', cursor: first.json().nextCursor });
      expect(second.json().users).toHaveLength(5);
      expect(second.json().nextCursor).toBeNull();

      const one = await search(device, { name: 'seed', limit: '1' });
      expect(one.statusCode).toBe(200);
      expect(one.json().users).toHaveLength(1);
      expect(one.json().nextCursor).toEqual(expect.any(String));

      const max = await search(device, { name: 'seed', limit: '50' });
      expect(max.statusCode).toBe(200);
      expect(max.json().users).toHaveLength(25);
      expect(max.json().nextCursor).toBeNull();
    });

    // Results are ordered by createdAt alone. Rows that share a timestamp have no defined order, so
    // paging through them with a cursor can repeat or skip people unless id is used as a tie-breaker.
    test('pages through users who share a createdAt without skipping or repeating anyone', async ({ env }) => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      await seedUsers(env, Array.from({ length: 5 }, (_, i) => ({ username: `tie-${i}`, createdAt })));
      const everyone = (await env.app.prisma.user.findMany({ select: { id: true } })).map((u) => u.id);

      const pages = await collectPages(env.device(), { name: 'seed', limit: '2' });

      const seen = pages.flat();
      expect(pages, '5 results at 2 per page is 3 pages').toHaveLength(3);
      expect(new Set(seen).size, 'nobody repeated').toBe(seen.length);
      expect([...seen].sort(), 'nobody skipped').toEqual([...everyone].sort());
    });

    // A cursor user can delete their account between two page loads. Soft deletion keeps the row, so the
    // cursor should still resolve and the next page should pick up where the first one ended.
    test('the next page still works when the cursor user was deleted in between', async ({ env }) => {
      const base = Date.UTC(2026, 0, 1);
      await seedUsers(env, [
        { username: 'cur-a', createdAt: new Date(base) },
        { username: 'cur-b', createdAt: new Date(base + 1000) },
        { username: 'cur-c', createdAt: new Date(base + 2000) },
      ]);
      const device = env.device();

      const page1 = await search(device, { name: 'seed', limit: '2' });
      expect(usernamesOf(page1)).toEqual(['cur-c', 'cur-b']);
      await env.app.prisma.user.update({ where: { username: 'cur-b' }, data: { deletedAt: new Date() } });

      const page2 = await search(device, { name: 'seed', limit: '2', cursor: page1.json().nextCursor });

      expect(page2.statusCode, page2.body).toBe(200);
      expect(usernamesOf(page2)).toEqual(['cur-a']);
    });

    test('an unknown cursor is a 404, not a server error', async ({ env }) => {
      await register(env.device());

      const res = await search(env.device(), { name: 'ada', cursor: 'no-such-user-id' });

      expect(res.statusCode, res.body).toBe(404);
    });
  });
});
