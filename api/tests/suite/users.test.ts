import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TestEnv } from '../harness.ts';
import { STRONG_PASSWORD, register, authenticatedSession } from './helpers/user.ts';

const env = new TestEnv();

before(() => env.start());
after(() => env.stop());
beforeEach(() => env.reset());

describe('POST /v1/users', () => {
  test('creates a user and returns 201 with the user body (no password)', async () => {
    const { res } = await register(env);

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.email, 'ada@example.com');
    assert.equal(body.username, 'ada-lovelace');
    assert.ok(body.id, 'id should be present');
    assert.equal(body.password, undefined, 'password must never be serialized');
    assert.equal(body.deletedAt, undefined, 'deletedAt must never be serialized');
  });

  test('sets a session cookie on successful registration', async () => {
    const { res, cookie } = await register(env);
    assert.equal(res.statusCode, 201);
    assert.ok(cookie, 'registration should establish a session');
  });

  test('rejects a weak password with 400', async () => {
    const { res } = await register(env, { password: '12345' });
    assert.equal(res.statusCode, 400);
  });

  test('rejects a duplicate email with 409', async () => {
    await register(env);
    const { res } = await register(env, { username: 'ada-lovelace-2' }, '10.0.0.2');
    assert.equal(res.statusCode, 409);
  });

  test('rejects a duplicate username with 409', async () => {
    await register(env);
    const { res } = await register(env, { email: 'ada2@example.com' }, '10.0.0.2');
    assert.equal(res.statusCode, 409);
  });
});

describe('GET /v1/users (self)', () => {
  test('returns the authenticated user with follower id arrays', async () => {
    const { cookie } = await authenticatedSession(env);
    const res = await env.app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.email, 'ada@example.com');
    assert.equal(body.password, undefined);
    assert.equal(body.deletedAt, undefined);
    assert.ok(Array.isArray(body.followers), 'followers should be an array');
    assert.ok(Array.isArray(body.following), 'following should be an array');
  });

  test('returns 401 when not logged in', async () => {
    const res = await env.app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(res.statusCode, 401);
  });
});

describe('GET /v1/users/:userId', () => {
  test('returns the target user without email or password', async () => {
    const { id: graceId } = await register(
      env,
      { email: 'grace@example.com', username: 'grace-hopper' },
      '10.0.0.2',
    );

    const res = await env.app.inject({
      method: 'GET',
      url: `/v1/users/${graceId}`,
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.id, graceId);
    assert.equal(body.email, undefined);
    assert.equal(body.password, undefined);
  });

  test('returns 404 for an unknown userId', async () => {
    const res = await env.app.inject({
      method: 'GET',
      url: '/v1/users/00000000-0000-0000-0000-000000000000',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(res.statusCode, 404);
  });

  test('returns 404 for a soft-deleted user', async () => {
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
      method: 'DELETE',
      url: '/v1/users',
      payload: { currentPassword: STRONG_PASSWORD },
      headers: { cookie: graceCookie, 'x-forwarded-for': '10.0.0.2' },
    });

    const res = await env.app.inject({
      method: 'GET',
      url: `/v1/users/${graceId}`,
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(res.statusCode, 404, 'soft-deleted user should not be found');
  });
});

describe('GET /v1/users/search', () => {
  test('finds users matching a single name term', async () => {
    await register(env, { email: 'grace@example.com', username: 'grace-hopper' }, '10.0.0.2');

    const res = await env.app.inject({
      method: 'GET',
      url: '/v1/users/search?name=grace',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 200);
    const { users } = res.json();
    assert.ok(Array.isArray(users));
    assert.ok(users.some((u: { username: string }) => u.username === 'grace-hopper'));
  });

  test('multi-word search ANDs terms across name fields', async () => {
    await register(
      env,
      { forename: 'Grace', surname: 'Hopper', email: 'grace@example.com', username: 'grace-hopper' },
      '10.0.0.2',
    );
    await register(
      env,
      { forename: 'Grace', surname: 'Jones', email: 'gjones@example.com', username: 'grace-jones' },
      '10.0.0.3',
    );

    const res = await env.app.inject({
      method: 'GET',
      url: '/v1/users/search?name=Grace+Hopper',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 200);
    const { users } = res.json();
    assert.equal(users.length, 1);
    assert.equal(users[0].username, 'grace-hopper');
  });

  test('role filter narrows results', async () => {
    await register(
      env,
      { email: 'grace@example.com', username: 'grace-hopper', role: 'BIOGRAPHER' },
      '10.0.0.2',
    );

    const res = await env.app.inject({
      method: 'GET',
      url: '/v1/users/search?name=grace&role=AUTOBIOGRAPHER',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 404);
  });

  test('returns 404 when no users match', async () => {
    const res = await env.app.inject({
      method: 'GET',
      url: '/v1/users/search?name=doesnotexist',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(res.statusCode, 404);
  });

  test('nextCursor is null on the last page', async () => {
    await register(env);
    const res = await env.app.inject({
      method: 'GET',
      url: '/v1/users/search?name=Ada&limit=20',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().nextCursor, null);
  });

  test('nextCursor advances the window without overlap', async () => {
    await register(env);
    await register(env, { forename: 'Ada', email: 'ada2@example.com', username: 'ada-second' }, '10.0.0.2');
    await register(env, { forename: 'Ada', email: 'ada3@example.com', username: 'ada-third' }, '10.0.0.3');

    const page1 = await env.app.inject({
      method: 'GET',
      url: '/v1/users/search?name=Ada&limit=2',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(page1.statusCode, 200);
    const { users: firstPage, nextCursor } = page1.json();
    assert.equal(firstPage.length, 2);
    assert.ok(nextCursor, 'should have a next cursor when results exceed the limit');

    const page2 = await env.app.inject({
      method: 'GET',
      url: `/v1/users/search?name=Ada&limit=2&cursor=${nextCursor}`,
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(page2.statusCode, 200);
    const { users: secondPage, nextCursor: noMore } = page2.json();
    assert.equal(secondPage.length, 1, 'only the remaining user on the second page');
    assert.equal(noMore, null);

    const firstIds = new Set(firstPage.map((u: { id: string }) => u.id));
    assert.ok(
      secondPage.every((u: { id: string }) => !firstIds.has(u.id)),
      'pages must not overlap',
    );
  });
});

describe('PATCH /v1/users', () => {
  test('updates non-sensitive fields without currentPassword', async () => {
    const { cookie } = await authenticatedSession(env);
    const res = await env.app.inject({
      method: 'PATCH',
      url: '/v1/users',
      payload: { forename: 'Augusta' },
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().forename, 'Augusta');
  });

  test('updates email when currentPassword is correct', async () => {
    const { cookie } = await authenticatedSession(env);
    const res = await env.app.inject({
      method: 'PATCH',
      url: '/v1/users',
      payload: { email: 'ada-new@example.com', currentPassword: STRONG_PASSWORD },
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().email, 'ada-new@example.com');
  });

  test('rejects an email update when currentPassword is wrong', async () => {
    const { cookie } = await authenticatedSession(env);
    const res = await env.app.inject({
      method: 'PATCH',
      url: '/v1/users',
      payload: { email: 'ada-new@example.com', currentPassword: 'wrong-password-here-123' },
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 401);
  });

  test('rejects a weak new password with 400', async () => {
    const { cookie } = await authenticatedSession(env);
    const res = await env.app.inject({
      method: 'PATCH',
      url: '/v1/users',
      payload: { password: '12345', currentPassword: STRONG_PASSWORD },
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 400);
  });

  test('never serializes password in the response', async () => {
    const { cookie } = await authenticatedSession(env);
    const res = await env.app.inject({
      method: 'PATCH',
      url: '/v1/users',
      payload: { forename: 'Augusta' },
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.json().password, undefined);
  });

  test('returns 401 when not logged in', async () => {
    const res = await env.app.inject({
      method: 'PATCH',
      url: '/v1/users',
      payload: { forename: 'Augusta' },
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(res.statusCode, 401);
  });
});

describe('DELETE /v1/users', () => {
  test('soft-deletes the account and destroys the session', async () => {
    const { cookie } = await authenticatedSession(env);
    const res = await env.app.inject({
      method: 'DELETE',
      url: '/v1/users',
      payload: { currentPassword: STRONG_PASSWORD },
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().password, undefined);

    const after = await env.app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(after.statusCode, 401, 'destroyed session must not authenticate');
  });

  test('rejects deletion when currentPassword is wrong', async () => {
    const { cookie } = await authenticatedSession(env);
    const res = await env.app.inject({
      method: 'DELETE',
      url: '/v1/users',
      payload: { currentPassword: 'wrong-password-here-123' },
      headers: { cookie, 'x-forwarded-for': '10.0.0.1' },
    });

    assert.equal(res.statusCode, 401);
  });

  test('returns 401 when not logged in', async () => {
    const res = await env.app.inject({
      method: 'DELETE',
      url: '/v1/users',
      payload: { currentPassword: STRONG_PASSWORD },
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    assert.equal(res.statusCode, 401);
  });
});
