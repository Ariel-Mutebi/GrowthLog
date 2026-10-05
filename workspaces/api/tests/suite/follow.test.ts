import { randomUUID } from 'node:crypto';
import { describe, expect } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import type { Device } from '../device.js';
import { ALAN, GRACE, deleteAccount, signedInDevice } from './helpers/user.js';

const follow = (device: Device, userId: string) => device.put(`/api/follow/${userId}`);
const unfollow = (device: Device, userId: string) => device.delete(`/api/follow/${userId}`);
const myFollowers = (device: Device) => device.get('/api/followers');
const whoIFollow = (device: Device) => device.get('/api/following');
const followersOf = (device: Device, userId: string) => device.get(`/api/followers/${userId}`);
const followingOf = (device: Device, userId: string) => device.get(`api/following/${userId}`);

/** Usernames in a list response, sorted because the endpoints promise no order. */
const usernamesOf = (res: LightMyRequestResponse) =>
  (res.json() as { username: string }[]).map((user) => user.username).sort();

/** Three registered people, each signed in on their own device. */
async function people(env: TestEnv) {
  const ada = await signedInDevice(env);
  const grace = await signedInDevice(env, GRACE);
  const alan = await signedInDevice(env, ALAN);
  return { ada, grace, alan };
}

describe('PUT /api/followers/:userId (follow)', () => {
  test('requires a session', async ({ env }) => {
    const res = await follow(env.device(), randomUUID());
    expect(res.statusCode).toBe(401);
  });

  test('follows the user, who then appears in both lists', async ({ env }) => {
    const { ada, grace } = await people(env);

    const res = await follow(ada.device, grace.id);

    expect(res.statusCode).toBe(204);
    expect(usernamesOf(await whoIFollow(ada.device))).toEqual(['grace-hopper']);
    expect(usernamesOf(await myFollowers(grace.device))).toEqual(['ada-lovelace']);
  });

  test('is one-directional', async ({ env }) => {
    const { ada, grace } = await people(env);

    await follow(ada.device, grace.id);

    expect(usernamesOf(await whoIFollow(grace.device)), 'grace follows nobody').toEqual([]);
    expect(usernamesOf(await myFollowers(ada.device)), 'ada has no followers').toEqual([]);
  });

  test('is idempotent: following twice succeeds and stores one follow', async ({ env }) => {
    const { ada, grace } = await people(env);

    const first = await follow(ada.device, grace.id);
    const second = await follow(ada.device, grace.id);

    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(204);
    expect(await env.app.prisma.follow.count()).toBe(1);
  });

  test('returns 404 for a user that does not exist and stores nothing', async ({ env }) => {
    const { ada } = await people(env);

    const res = await follow(ada.device, randomUUID());

    expect(res.statusCode, res.body).toBe(404);
    expect(await env.app.prisma.follow.count()).toBe(0);
  });

  test('returns 404 for a soft-deleted user and stores nothing', async ({ env }) => {
    const { ada, grace } = await people(env);
    await deleteAccount(grace.device);

    const res = await follow(ada.device, grace.id);

    expect(res.statusCode, res.body).toBe(404);
    expect(await env.app.prisma.follow.count()).toBe(0);
  });

  test('does not let a user follow themselves', async ({ env }) => {
    const { ada } = await people(env);

    const res = await follow(ada.device, ada.id);

    expect(res.statusCode, res.body).toBe(400);
    expect(await env.app.prisma.follow.count()).toBe(0);
  });
});

describe('DELETE /api/followers/:userId (unfollow)', () => {
  test('requires a session', async ({ env }) => {
    const res = await unfollow(env.device(), randomUUID());
    expect(res.statusCode).toBe(401);
  });

  test('removes the follow from both lists', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);

    const res = await unfollow(ada.device, grace.id);

    expect(res.statusCode).toBe(204);
    expect(usernamesOf(await whoIFollow(ada.device))).toEqual([]);
    expect(usernamesOf(await myFollowers(grace.device))).toEqual([]);
  });

  test('is idempotent: unfollowing someone you do not follow, or who does not exist, succeeds', async ({ env }) => {
    const { ada, grace } = await people(env);

    expect((await unfollow(ada.device, grace.id)).statusCode, 'never followed').toBe(204);
    expect((await unfollow(ada.device, randomUUID())).statusCode, 'unknown user').toBe(204);
  });

  test('removes only that follow', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(ada.device, grace.id);
    await follow(ada.device, alan.id);

    await unfollow(ada.device, grace.id);

    expect(usernamesOf(await whoIFollow(ada.device))).toEqual(['alan-turing']);
  });

  test('does not remove the follow in the other direction', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);
    await follow(grace.device, ada.id);

    await unfollow(ada.device, grace.id);

    expect(usernamesOf(await myFollowers(ada.device)), 'grace still follows ada').toEqual(['grace-hopper']);
  });
});

describe('GET /api/followers/myFollowers', () => {
  test('requires a session', async ({ env }) => {
    const res = await myFollowers(env.device());
    expect(res.statusCode).toBe(401);
  });

  test('returns an empty list when nobody follows you', async ({ env }) => {
    const { ada } = await people(env);

    const res = await myFollowers(ada.device);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  test('lists everyone who follows you, and only them', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(grace.device, ada.id);
    await follow(alan.device, ada.id);
    await follow(ada.device, alan.id);

    const res = await myFollowers(ada.device);

    expect(res.statusCode).toBe(200);
    expect(usernamesOf(res)).toEqual(['alan-turing', 'grace-hopper']);
  });

  test('returns only public fields', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);

    const [entry] = (await myFollowers(grace.device)).json();

    expect(entry).toMatchObject({
      id: ada.id,
      forename: 'Ada',
      surname: 'Lovelace',
      username: 'ada-lovelace',
      avatarKey: null,
    });
    expect(entry).not.toHaveProperty('email');
    expect(entry).not.toHaveProperty('password');
  });
});

describe('GET /api/followers/whoIFollow', () => {
  test('requires a session', async ({ env }) => {
    const res = await whoIFollow(env.device());
    expect(res.statusCode).toBe(401);
  });

  test('returns an empty list when you follow nobody', async ({ env }) => {
    const { ada } = await people(env);

    const res = await whoIFollow(ada.device);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  test('lists everyone you follow, and only them', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(ada.device, grace.id);
    await follow(ada.device, alan.id);
    await follow(grace.device, ada.id);

    const res = await whoIFollow(ada.device);

    expect(res.statusCode).toBe(200);
    expect(usernamesOf(res)).toEqual(['alan-turing', 'grace-hopper']);
  });
});

describe('public lists of another user', () => {
  test('GET /:userId/followers needs no session', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(grace.device, ada.id);

    const res = await followersOf(env.device(), ada.id);

    expect(res.statusCode).toBe(200);
    expect(usernamesOf(res)).toEqual(['grace-hopper']);
  });

  test('GET /:userId/following needs no session', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(ada.device, grace.id);

    const res = await followingOf(env.device(), ada.id);

    expect(res.statusCode).toBe(200);
    expect(usernamesOf(res)).toEqual(['grace-hopper']);
  });

  test('return only public fields', async ({ env }) => {
    const { ada, grace } = await people(env);
    await follow(grace.device, ada.id);

    const [entry] = (await followersOf(env.device(), ada.id)).json();

    expect(entry).toMatchObject({ id: grace.id, username: 'grace-hopper', avatarKey: null });
    expect(entry).not.toHaveProperty('email');
    expect(entry).not.toHaveProperty('password');
  });

  test('return an empty list for a user with no followers, or who does not exist', async ({ env }) => {
    const { ada } = await people(env);
    const anonymous = env.device();

    expect((await followersOf(anonymous, ada.id)).json(), 'no followers').toEqual([]);
    expect((await followingOf(anonymous, ada.id)).json(), 'follows nobody').toEqual([]);
    expect((await followersOf(anonymous, randomUUID())).json(), 'unknown user').toEqual([]);
  });
});

describe('soft-deleted accounts', () => {
  test('a deleted follower disappears from the followed user\'s followers', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(grace.device, ada.id);
    await follow(alan.device, ada.id);

    await deleteAccount(grace.device);

    expect(usernamesOf(await myFollowers(ada.device))).toEqual(['alan-turing']);
    expect(usernamesOf(await followersOf(env.device(), ada.id)), 'public list too').toEqual(['alan-turing']);
  });

  test('a deleted account disappears from the lists of the people who follow it', async ({ env }) => {
    const { ada, grace, alan } = await people(env);
    await follow(ada.device, grace.id);
    await follow(ada.device, alan.id);

    await deleteAccount(grace.device);

    expect(usernamesOf(await whoIFollow(ada.device))).toEqual(['alan-turing']);
    expect(usernamesOf(await followingOf(env.device(), ada.id)), 'public list too').toEqual(['alan-turing']);
  });
});
