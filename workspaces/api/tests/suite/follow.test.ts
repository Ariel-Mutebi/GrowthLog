import { describe, expect } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import type { Device } from '../device.js';
import { ALAN, GRACE, STRONG_PASSWORD, deleteAccount, signedInDevice } from './helpers/user.js';

type Person = Awaited<ReturnType<typeof signedInDevice>>;

const follow = (device: Device, userId: string) => device.put(`/api/follow/${userId}`);
const unfollow = (device: Device, userId: string) => device.delete(`/api/follow/${userId}`);
const followersOf = (device: Device, userId: string) => device.get(`/api/followers/${userId}`);
const followingOf = (device: Device, userId: string) => device.get(`/api/following/${userId}`);

/** Usernames in a list response, sorted because the endpoints promise no order. */
const usernamesOf = (res: LightMyRequestResponse) =>
  (res.json() as { username: string }[]).map((user) => user.username).sort();

const followRows = (env: TestEnv) => env.app.prisma.follow.findMany();
const followCount = (env: TestEnv) => env.app.prisma.follow.count();

/** Every stored follow as a sorted "followerId>followingId" string, for comparing whole tables at once. */
const edges = async (env: TestEnv) =>
  (await followRows(env)).map((row) => `${row.followerId}>${row.followingId}`).sort();
const edge = (follower: Person, followed: Person) => `${follower.id}>${followed.id}`;

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

/**
 * The two public list endpoints are mirror images, so their shared behaviour is tested once for each.
 * `connect(subject, other)` creates the follow that puts `other` into `subject`'s list. Calling it with the
 * arguments swapped therefore creates the opposite-direction follow, which must never appear.
 */
const lists = [
  {
    name: 'followers',
    of: followersOf,
    connect: (subject: Person, other: Person) => follow(other.device, subject.id),
  },
  {
    name: 'following',
    of: followingOf,
    connect: (subject: Person, other: Person) => follow(subject.device, other.id),
  },
];

/** Well-formed cuid2s are the only ids that may reach the database; none of these are. */
const MALFORMED_IDS = [
  'not-a-cuid',
  'x\'; DROP TABLE "User"; --',
  '5488d11e-c932-4da9-92f2-7f3f19b7fcb1', // a UUID
  'cjld2cjxh0000qzrmn831i7rn', // a cuid v1, from before the migration to cuid2
];

describe('authentication', () => {
  test.for([
    { method: 'PUT', call: follow },
    { method: 'DELETE', call: unfollow },
  ])('$method /api/follow/:userId requires a session and leaves existing follows alone', async ({ call }, { env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);

    const res = await call(env.device(), grace.id);

    expect(res.statusCode).toBe(401);
    expect(await edges(env), 'the follow table must be untouched').toEqual([edge(ada, grace)]);
  });
});

describe('PUT /api/follow/:userId (follow)', () => {
  test('follows the user: one row owned by the caller, listed one-way in both public lists', async ({ env }) => {
    const { ada, grace } = await people(env);

    const res = await follow(ada.device, grace.id);

    expect(res.statusCode).toBe(204);
    expect(res.body, '204 must have an empty body').toBe('');
    expect(await edges(env), 'exactly one row, ada as follower').toEqual([edge(ada, grace)]);
    const anonymous = env.device();
    expect(usernamesOf(await followingOf(anonymous, ada.id))).toEqual(['grace-hopper']);
    expect(usernamesOf(await followersOf(anonymous, grace.id))).toEqual(['ada-lovelace']);
    expect(usernamesOf(await followingOf(anonymous, grace.id)), 'grace follows nobody').toEqual([]);
    expect(usernamesOf(await followersOf(anonymous, ada.id)), 'ada has no followers').toEqual([]);
  });

  // Also covers plain sequential duplicates. Races the check-then-insert in the service; the unique
  // constraint must be absorbed, not surfaced as a 500.
  test('parallel duplicate follows all succeed and store one follow', async ({ env }) => {
    const { ada, grace } = await people(env);

    const responses = await Promise.all(Array.from({ length: 10 }, () => follow(ada.device, grace.id)));

    expect(responses.map((r) => r.statusCode)).toEqual(Array(10).fill(204));
    expect(await edges(env)).toEqual([edge(ada, grace)]);
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

  // Unknown ids are covered under "ids that match no user".
  test('is idempotent: unfollowing someone you do not follow, or yourself, succeeds', async ({ env }) => {
    const { ada, grace } = await people(env);

    expect((await unfollow(ada.device, grace.id)).statusCode, 'never followed').toBe(204);
    expect((await unfollow(ada.device, ada.id)).statusCode, 'yourself').toBe(204);
  });

  // Also covers plain sequential duplicates. Races delete against delete; the loser's P2025 must be
  // absorbed, not surfaced as a 500.
  test('parallel duplicate unfollows all succeed', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);

    const responses = await Promise.all(Array.from({ length: 10 }, () => unfollow(ada.device, grace.id)));

    expect(responses.map((r) => r.statusCode)).toEqual(Array(10).fill(204));
    expect(await followCount(env)).toBe(0);
  });

  test('removes only the caller\'s follow of that user', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(ada.device, grace.id);
    await follow(ada.device, alan.id); // the caller's follow of someone else
    await follow(grace.device, ada.id); // the follow in the other direction
    await follow(alan.device, grace.id); // someone else's follow of the same target

    await unfollow(ada.device, grace.id);

    expect(await edges(env)).toEqual(
      [edge(ada, alan), edge(grace, ada), edge(alan, grace)].sort(),
    );
  });
});

describe.for(lists)('GET /api/$name/:userId', ({ of, connect }) => {
  test('needs no session, and returns the same list to anonymous visitors, the user and other users', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await connect(ada, grace);

    const asAnonymous = await of(env.device(), ada.id);
    const asSelf = await of(ada.device, ada.id);
    const asOther = await of(alan.device, ada.id);

    expect(asAnonymous.statusCode).toBe(200);
    expect(usernamesOf(asAnonymous)).toEqual(['grace-hopper']);
    expect(usernamesOf(asSelf)).toEqual(['grace-hopper']);
    expect(usernamesOf(asOther)).toEqual(['grace-hopper']);
  });

  test('returns an empty list when there is nobody to list', async ({ env }) => {
    const { ada } = await people(env);

    const res = await of(env.device(), ada.id);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  test('lists everyone it should, and only them', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await connect(ada, grace);
    await connect(ada, alan);
    await connect(alan, ada); // the opposite direction: must not appear in ada's list

    const res = await of(env.device(), ada.id);

    expect(res.statusCode).toBe(200);
    expect(usernamesOf(res)).toEqual(['alan-turing', 'grace-hopper']);
  });

  test('returns only public fields', async ({ env }) => {
    const { ada, grace } = await people(env);
    await connect(ada, grace);

    const body = (await of(env.device(), ada.id)).json();

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

  test('hides a soft-deleted account from the list', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await connect(ada, grace);
    await connect(ada, alan);

    await deleteAccount(grace.device);

    expect(usernamesOf(await of(env.device(), ada.id))).toEqual(['alan-turing']);
  });
});

describe('followers and following together', () => {
  test('mutual follows appear in both users\' lists, on both endpoints', async ({ env }) => {
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
  test('a well-formed id that nobody owns is treated as an unknown user on every route', async ({ env }) => {
    const { ada } = await people(env);
    const anonymous = env.device();
    const unknown = 'cdoesnotexist'.padEnd(24, '0');

    const put = await follow(ada.device, unknown);
    expect(put.statusCode, put.body).toBe(404);
    expect(put.json()).toMatchObject({
      error: 'NotFound',
      message: 'The user you are trying to follow cannot be found',
    });
    expect((await unfollow(ada.device, unknown)).statusCode, 'DELETE').toBe(204);
    const followers = await followersOf(anonymous, unknown);
    expect(followers.statusCode, 'GET followers').toBe(200);
    expect(followers.json()).toEqual([]);
    const following = await followingOf(anonymous, unknown);
    expect(following.statusCode, 'GET following').toBe(200);
    expect(following.json()).toEqual([]);
    expect(await followCount(env)).toBe(0);
  });

  // Ids are validated against the cuid2 pattern before anything reaches the database, so a malformed id
  // is a client error on every route, never a 404, a 5xx, or a query.
  test.for(MALFORMED_IDS)('the malformed id %s is rejected with 400 on every route', async (raw, { env }) => {
    const { ada } = await people(env);
    const anonymous = env.device();
    const id = encodeURIComponent(raw);

    expect((await follow(ada.device, id)).statusCode, 'PUT').toBe(400);
    expect((await unfollow(ada.device, id)).statusCode, 'DELETE').toBe(400);
    expect((await followersOf(anonymous, id)).statusCode, 'GET followers').toBe(400);
    expect((await followingOf(anonymous, id)).statusCode, 'GET following').toBe(400);
    expect(await followCount(env)).toBe(0);
  });
});

describe('soft-deleted accounts', () => {
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

    expect(await edges(env), 'only the follow that did not involve ada should remain').toEqual([
      edge(grace, alan),
    ]);
  });
});
