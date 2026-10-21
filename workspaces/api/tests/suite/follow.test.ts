import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import type { Device } from '../device.js';
import { ALAN, GRACE, STRONG_PASSWORD, deleteAccount, signedInDevice } from './helpers/user.js';

const follow = (device: Device, userId: string) => device.put(`/api/follow/${userId}`);
const unfollow = (device: Device, userId: string) => device.delete(`/api/follow/${userId}`);
const followersOf = (device: Device, userId: string) => device.get(`/api/followers/${userId}`);
const followingOf = (device: Device, userId: string) => device.get(`/api/following/${userId}`);

/** Usernames in a list response, sorted because the endpoints promise no order. */
const usernamesOf = (res: LightMyRequestResponse) =>
  (res.json() as { username: string }[]).map((user) => user.username).sort();

const followRows = (env: TestEnv) => env.app.prisma.follow.findMany();
const followCount = (env: TestEnv) => env.app.prisma.follow.count();

/** Three registered people, each signed in on their own device. */
async function people(env: TestEnv) {
  const ada = await signedInDevice(env);
  const grace = await signedInDevice(env, GRACE);
  const alan = await signedInDevice(env, ALAN);
  return { ada, grace, alan };
}

/** Logs in on a fresh device. Within the recovery window this also restores a soft-deleted account. */
async function logIn(env: TestEnv, email: string) {
  const device = env.device();
  const res = await device.post('/api/sessions', { email, password: STRONG_PASSWORD });
  expect(res.statusCode, `login failed: ${res.body}`).toBe(200);
  return device;
}

describe('PUT /api/follow/:userId (follow)', () => {
  test('requires a session', async ({ env }) => {
    const { grace } = await people(env);

    const res = await follow(env.device(), grace.id);

    expect(res.statusCode).toBe(401);
    expect(await followCount(env)).toBe(0);
  });

  test('follows the user, who then appears in both public lists', async ({ env }) => {
    const { ada, grace } = await people(env);

    const res = await follow(ada.device, grace.id);

    expect(res.statusCode).toBe(204);
    expect(res.body, '204 must have an empty body').toBe('');
    expect(usernamesOf(await followingOf(env.device(), ada.id))).toEqual(['grace-hopper']);
    expect(usernamesOf(await followersOf(env.device(), grace.id))).toEqual(['ada-lovelace']);
  });

  test('stores exactly one row, owned by the signed-in user as follower', async ({ env }) => {
    const { ada, grace } = await people(env);

    await follow(ada.device, grace.id);

    const rows = await followRows(env);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ followerId: ada.id, followingId: grace.id });
  });

  test('is one-directional', async ({ env }) => {
    const { ada, grace } = await people(env);

    await follow(ada.device, grace.id);

    const anonymous = env.device();
    expect(usernamesOf(await followingOf(anonymous, grace.id)), 'grace follows nobody').toEqual([]);
    expect(usernamesOf(await followersOf(anonymous, ada.id)), 'ada has no followers').toEqual([]);
  });

  test('is idempotent: following twice succeeds and stores one follow', async ({ env }) => {
    const { ada, grace } = await people(env);

    const first = await follow(ada.device, grace.id);
    const second = await follow(ada.device, grace.id);

    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(204);
    expect(await followCount(env)).toBe(1);
    expect(usernamesOf(await followersOf(env.device(), grace.id)), 'no duplicate entry').toEqual([
      'ada-lovelace',
    ]);
  });

  test('parallel duplicate follows all succeed and store one follow', async ({ env }) => {
    const { ada, grace } = await people(env);

    // Races the check-then-insert in the service; the unique constraint must be absorbed, not surfaced as a 500.
    const responses = await Promise.all(Array.from({ length: 10 }, () => follow(ada.device, grace.id)));

    expect(responses.map((r) => r.statusCode)).toEqual(Array(10).fill(204));
    expect(await followCount(env)).toBe(1);
  });

  test('can follow again after unfollowing', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);
    await unfollow(ada.device, grace.id);

    const res = await follow(ada.device, grace.id);

    expect(res.statusCode).toBe(204);
    expect(usernamesOf(await followersOf(env.device(), grace.id))).toEqual(['ada-lovelace']);
  });

  test('lets several users follow the same person, and one user follow several people', async ({ env }) => {
    const { ada, grace, alan } = await people(env);

    await follow(ada.device, alan.id);
    await follow(grace.device, alan.id);
    await follow(ada.device, grace.id);

    expect(await followCount(env)).toBe(3);
    expect(usernamesOf(await followersOf(env.device(), alan.id))).toEqual(['ada-lovelace', 'grace-hopper']);
    expect(usernamesOf(await followingOf(env.device(), ada.id))).toEqual(['alan-turing', 'grace-hopper']);
  });

  test('returns 404 for a user that does not exist and stores nothing', async ({ env }) => {
    const { ada } = await people(env);

    const res = await follow(ada.device, randomUUID());

    expect(res.statusCode, res.body).toBe(404);
    expect(res.json()).toMatchObject({
      error: 'NotFound',
      message: 'The user you are trying to follow cannot be found',
    });
    expect(await followCount(env)).toBe(0);
  });

  test('returns 404 for a soft-deleted user and stores nothing', async ({ env }) => {
    const { ada, grace } = await people(env);
    await deleteAccount(grace.device);

    const res = await follow(ada.device, grace.id);

    expect(res.statusCode, res.body).toBe(404);
    expect(await followCount(env)).toBe(0);
  });

  test('does not let a user follow themselves', async ({ env }) => {
    const { ada } = await people(env);

    const res = await follow(ada.device, ada.id);

    expect(res.statusCode, res.body).toBe(400);
    expect(res.json()).toMatchObject({ error: 'BadRequest', message: 'You cannot follow yourself' });
    expect(await followCount(env)).toBe(0);
  });
});

describe('DELETE /api/follow/:userId (unfollow)', () => {
  test('requires a session and leaves existing follows alone', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);

    const res = await unfollow(env.device(), grace.id);

    expect(res.statusCode).toBe(401);
    expect(await followCount(env), 'the follow must survive an unauthenticated attempt').toBe(1);
  });

  test('removes the follow from both public lists and the database', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);

    const res = await unfollow(ada.device, grace.id);

    expect(res.statusCode).toBe(204);
    expect(res.body, '204 must have an empty body').toBe('');
    expect(usernamesOf(await followingOf(env.device(), ada.id))).toEqual([]);
    expect(usernamesOf(await followersOf(env.device(), grace.id))).toEqual([]);
    expect(await followCount(env)).toBe(0);
  });

  test('is idempotent: unfollowing someone you do not follow, yourself, or an unknown user succeeds', async ({ env }) => {
    const { ada, grace } = await people(env);

    expect((await unfollow(ada.device, grace.id)).statusCode, 'never followed').toBe(204);
    expect((await unfollow(ada.device, ada.id)).statusCode, 'yourself').toBe(204);
    expect((await unfollow(ada.device, randomUUID())).statusCode, 'unknown user').toBe(204);
  });

  test('unfollowing twice in a row succeeds both times', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);

    const first = await unfollow(ada.device, grace.id);
    const second = await unfollow(ada.device, grace.id);

    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(204);
  });

  test('parallel duplicate unfollows all succeed', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);

    // Races delete against delete; the loser's P2025 must be absorbed, not surfaced as a 500.
    const responses = await Promise.all(Array.from({ length: 10 }, () => unfollow(ada.device, grace.id)));

    expect(responses.map((r) => r.statusCode)).toEqual(Array(10).fill(204));
    expect(await followCount(env)).toBe(0);
  });

  test('removes only that follow', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(ada.device, grace.id);
    await follow(ada.device, alan.id);

    await unfollow(ada.device, grace.id);

    expect(usernamesOf(await followingOf(env.device(), ada.id))).toEqual(['alan-turing']);
  });

  test('does not remove the follow in the other direction', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);
    await follow(grace.device, ada.id);

    await unfollow(ada.device, grace.id);

    expect(usernamesOf(await followersOf(env.device(), ada.id)), 'grace still follows ada').toEqual([
      'grace-hopper',
    ]);
  });

  test('cannot remove someone else\'s follow', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(grace.device, alan.id);

    // Ada never followed alan, so this is a no-op for her and must not touch grace's follow.
    const res = await unfollow(ada.device, alan.id);

    expect(res.statusCode).toBe(204);
    expect(usernamesOf(await followersOf(env.device(), alan.id))).toEqual(['grace-hopper']);
    expect(await followCount(env)).toBe(1);
  });
});

describe('GET /api/followers/:userId (followers)', () => {
  test('needs no session', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(grace.device, ada.id);

    const res = await followersOf(env.device(), ada.id);

    expect(res.statusCode).toBe(200);
    expect(usernamesOf(res)).toEqual(['grace-hopper']);
  });

  test('returns the same list to anonymous visitors, the user themself and other users', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(grace.device, ada.id);

    const asAnonymous = await followersOf(env.device(), ada.id);
    const asSelf = await followersOf(ada.device, ada.id);
    const asOther = await followersOf(alan.device, ada.id);

    expect(usernamesOf(asSelf)).toEqual(usernamesOf(asAnonymous));
    expect(usernamesOf(asOther)).toEqual(usernamesOf(asAnonymous));
  });

  test('returns an empty list when nobody follows the user', async ({ env }) => {
    const { ada } = await people(env);

    const res = await followersOf(env.device(), ada.id);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  test('returns an empty list for a user that does not exist', async ({ env }) => {
    const res = await followersOf(env.device(), randomUUID());

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  test('lists everyone who follows the user, and only them', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(grace.device, ada.id);
    await follow(alan.device, ada.id);
    await follow(ada.device, alan.id); // the other direction: must not appear

    const res = await followersOf(env.device(), ada.id);

    expect(res.statusCode).toBe(200);
    expect(usernamesOf(res)).toEqual(['alan-turing', 'grace-hopper']);
  });

  test('returns only public fields', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(grace.device, ada.id);

    const body = (await followersOf(env.device(), ada.id)).json();

    expect(body).toHaveLength(1);
    const [entry] = body;
    expect(entry).toMatchObject({
      id: grace.id,
      forename: 'Grace',
      surname: 'Hopper',
      username: 'grace-hopper',
      avatarKey: null,
    });
    for (const secret of ['email', 'password', 'deletedAt', 'avatarId', 'avatar']) {
      expect(entry, `"${secret}" must not be exposed`).not.toHaveProperty(secret);
    }
  });
});

describe('GET /api/following/:userId (following)', () => {
  test('needs no session', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);

    const res = await followingOf(env.device(), ada.id);

    expect(res.statusCode).toBe(200);
    expect(usernamesOf(res)).toEqual(['grace-hopper']);
  });

  test('returns an empty list when the user follows nobody', async ({ env }) => {
    const { ada } = await people(env);

    const res = await followingOf(env.device(), ada.id);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  test('returns an empty list for a user that does not exist', async ({ env }) => {
    const res = await followingOf(env.device(), randomUUID());

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  test('lists everyone the user follows, and only them', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(ada.device, grace.id);
    await follow(ada.device, alan.id);
    await follow(grace.device, ada.id); // the other direction: must not appear

    const res = await followingOf(env.device(), ada.id);

    expect(res.statusCode).toBe(200);
    expect(usernamesOf(res)).toEqual(['alan-turing', 'grace-hopper']);
  });

  test('returns only public fields', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);

    const body = (await followingOf(env.device(), ada.id)).json();

    expect(body).toHaveLength(1);
    const [entry] = body;
    expect(entry).toMatchObject({
      id: grace.id,
      forename: 'Grace',
      surname: 'Hopper',
      username: 'grace-hopper',
      avatarKey: null,
    });
    for (const secret of ['email', 'password', 'deletedAt', 'avatarId', 'avatar']) {
      expect(entry, `"${secret}" must not be exposed`).not.toHaveProperty(secret);
    }
  });

  test('mutual follows appear in both users lists, on both endpoints', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);
    await follow(grace.device, ada.id);
    const anonymous = env.device();

    expect(usernamesOf(await followersOf(anonymous, ada.id))).toEqual(['grace-hopper']);
    expect(usernamesOf(await followingOf(anonymous, ada.id))).toEqual(['grace-hopper']);
    expect(usernamesOf(await followersOf(anonymous, grace.id))).toEqual(['ada-lovelace']);
    expect(usernamesOf(await followingOf(anonymous, grace.id))).toEqual(['ada-lovelace']);
  });
});

describe('ids that match no user', () => {
  // User ids are cuids and :userId is an unconstrained string, so anything that is not an existing id
  // must behave exactly like an unknown user instead of erroring.
  test.for(['not-a-cuid', 'x\'; DROP TABLE "User"; --'])('%s is treated as an unknown user', async (raw, { env }) => {
    const { ada } = await people(env);
    const anonymous = env.device();
    const id = encodeURIComponent(raw);

    expect((await follow(ada.device, id)).statusCode, 'PUT').toBe(404);
    expect((await unfollow(ada.device, id)).statusCode, 'DELETE').toBe(204);
    expect((await followersOf(anonymous, id)).json(), 'GET followers').toEqual([]);
    expect((await followingOf(anonymous, id)).json(), 'GET following').toEqual([]);
    expect(await followCount(env)).toBe(0);
  });
});

describe('soft-deleted accounts', () => {
  test('a deleted follower disappears from the followed user\'s followers', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(grace.device, ada.id);
    await follow(alan.device, ada.id);

    await deleteAccount(grace.device);

    expect(usernamesOf(await followersOf(env.device(), ada.id))).toEqual(['alan-turing']);
  });

  test('a deleted account disappears from the following lists of the people who follow it', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(ada.device, grace.id);
    await follow(ada.device, alan.id);

    await deleteAccount(grace.device);

    expect(usernamesOf(await followingOf(env.device(), ada.id))).toEqual(['alan-turing']);
  });

  // The service filters the *other* side of each follow but never checks the requested user, so these are
  // expected to fail today. GET /api/users/:id already hides deleted accounts; the lists should too.
  test('a deleted user\'s own lists are empty, consistent with their profile being 404', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(ada.device, grace.id); // ada follows grace
    await follow(grace.device, alan.id); // grace follows alan
    await deleteAccount(grace.device);
    const anonymous = env.device();

    expect((await followersOf(anonymous, grace.id)).json(), 'grace\'s followers').toEqual([]);
    expect((await followingOf(anonymous, grace.id)).json(), 'grace\'s following').toEqual([]);
  });

  test('follows are kept through a soft delete and reappear when the account is restored', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);
    await follow(grace.device, ada.id);
    await deleteAccount(grace.device);
    const anonymous = env.device();

    expect(await followCount(env), 'rows are kept while the account is recoverable').toBe(2);
    expect(usernamesOf(await followingOf(anonymous, ada.id)), 'hidden while deleted').toEqual([]);
    expect(usernamesOf(await followersOf(anonymous, ada.id)), 'hidden while deleted').toEqual([]);

    await logIn(env, GRACE.email);

    expect(usernamesOf(await followingOf(anonymous, ada.id)), 'back after restore').toEqual(['grace-hopper']);
    expect(usernamesOf(await followersOf(anonymous, ada.id)), 'back after restore').toEqual(['grace-hopper']);
  });

  test('unfollowing a deleted account removes the follow for good, even after it is restored', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);
    await deleteAccount(grace.device);

    const res = await unfollow(ada.device, grace.id);

    expect(res.statusCode).toBe(204);
    expect(await followCount(env)).toBe(0);

    await logIn(env, GRACE.email);
    expect(usernamesOf(await followersOf(env.device(), grace.id))).toEqual([]);
  });

  test('a user who deleted their account can no longer follow with the old session', async ({ env }) => {
    const { ada, grace } = await people(env);
    await deleteAccount(ada.device);

    const res = await follow(ada.device, grace.id);

    expect(res.statusCode).toBe(401);
    expect(await followCount(env)).toBe(0);
  });
});

describe('hard deletion', () => {
  test('removing a user row removes their follows in both directions, and nobody else\'s', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(ada.device, grace.id);
    await follow(grace.device, ada.id);
    await follow(grace.device, alan.id);

    await env.app.prisma.user.delete({ where: { id: ada.id } });

    const rows = await followRows(env);
    expect(rows, 'only the follow that did not involve ada should remain').toHaveLength(1);
    expect(rows[0]).toMatchObject({ followerId: grace.id, followingId: alan.id });
  });
});
