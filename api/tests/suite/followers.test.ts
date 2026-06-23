import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestEnv } from '../harness.ts';
import { register, authenticatedSession } from './helpers/user.ts';

const env = new TestEnv();

async function followerIds(cookie: string, ip = '10.0.0.1'): Promise<string[]> {
  const res = await env.app.inject({
    method: 'GET',
    url: '/v1/users',
    headers: { cookie, 'x-forwarded-for': ip },
  });
  return res.json().followers;
}

before(() => env.start());
after(() => env.stop());
beforeEach(() => env.reset());

describe('PUT /v1/followers/:userId', () => {
  test('follows another user and returns 204', async () => {
    const { cookie: adaCookie } = await authenticatedSession(env);
    const { id: graceId } = await register(
      env,
      { email: 'grace@example.com', username: 'grace-hopper' },
      '10.0.0.2',
    );

    const res = await env.app.inject({
      method: 'PUT',
      url: `/v1/followers/${graceId}`,
      headers: { cookie: adaCookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 204);
  });

  test('is idempotent: following an already-followed user returns 204', async () => {
    const { cookie: adaCookie } = await authenticatedSession(env);
    const { id: graceId } = await register(
      env,
      { email: 'grace@example.com', username: 'grace-hopper' },
      '10.0.0.2',
    );

    await env.app.inject({
      method: 'PUT',
      url: `/v1/followers/${graceId}`,
      headers: { cookie: adaCookie, 'x-forwarded-for': '10.0.0.1' },
    });
    const second = await env.app.inject({
      method: 'PUT',
      url: `/v1/followers/${graceId}`,
      headers: { cookie: adaCookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(second.statusCode, 204);
  });

  test('follow is reflected in the target user\'s follower list', async () => {
    const { id: adaId, cookie: adaCookie } = await authenticatedSession(env);
    const { id: graceId } = await register(
      env,
      { email: 'grace@example.com', username: 'grace-hopper' },
      '10.0.0.2',
    );
    const { cookie: graceCookie } = await authenticatedSession(
      env,
      { email: 'grace@example.com', username: 'grace-hopper' },
      '10.0.0.2',
    );

    await env.app.inject({
      method: 'PUT',
      url: `/v1/followers/${graceId}`,
      headers: { cookie: adaCookie, 'x-forwarded-for': '10.0.0.1' },
    });

    const graceFollowers = await followerIds(graceCookie, '10.0.0.2');
    assert.ok(graceFollowers.includes(adaId), 'Ada should appear in Grace\'s follower list');
  });

  test('returns 401 when not logged in', async () => {
    const res = await env.app.inject({
      method: 'PUT',
      url: '/v1/followers/00000000-0000-0000-0000-000000000000',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(res.statusCode, 401);
  });
});

describe('DELETE /v1/followers/:userId', () => {
  test('unfollows a followed user and returns 204', async () => {
    const { cookie: adaCookie } = await authenticatedSession(env);
    const { id: graceId } = await register(
      env,
      { email: 'grace@example.com', username: 'grace-hopper' },
      '10.0.0.2',
    );

    await env.app.inject({
      method: 'PUT',
      url: `/v1/followers/${graceId}`,
      headers: { cookie: adaCookie, 'x-forwarded-for': '10.0.0.1' },
    });
    const res = await env.app.inject({
      method: 'DELETE',
      url: `/v1/followers/${graceId}`,
      headers: { cookie: adaCookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 204);
  });

  test('is idempotent: unfollowing a non-followed user returns 204', async () => {
    const { cookie: adaCookie } = await authenticatedSession(env);
    const { id: graceId } = await register(
      env,
      { email: 'grace@example.com', username: 'grace-hopper' },
      '10.0.0.2',
    );

    const res = await env.app.inject({
      method: 'DELETE',
      url: `/v1/followers/${graceId}`,
      headers: { cookie: adaCookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 204);
  });

  test('unfollow is reflected in the target user\'s follower list', async () => {
    const { id: adaId, cookie: adaCookie } = await authenticatedSession(env);
    const { id: graceId } = await register(
      env,
      { email: 'grace@example.com', username: 'grace-hopper' },
      '10.0.0.2',
    );
    const { cookie: graceCookie } = await authenticatedSession(
      env,
      { email: 'grace@example.com', username: 'grace-hopper' },
      '10.0.0.2',
    );

    await env.app.inject({
      method: 'PUT',
      url: `/v1/followers/${graceId}`,
      headers: { cookie: adaCookie, 'x-forwarded-for': '10.0.0.1' },
    });
    await env.app.inject({
      method: 'DELETE',
      url: `/v1/followers/${graceId}`,
      headers: { cookie: adaCookie, 'x-forwarded-for': '10.0.0.1' },
    });

    const graceFollowers = await followerIds(graceCookie, '10.0.0.2');
    assert.ok(!graceFollowers.includes(adaId), 'Ada should no longer appear in Grace\'s follower list');
  });

  test('returns 401 when not logged in', async () => {
    const res = await env.app.inject({
      method: 'DELETE',
      url: '/v1/followers/00000000-0000-0000-0000-000000000000',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(res.statusCode, 401);
  });
});
