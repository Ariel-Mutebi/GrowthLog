import { describe, expect } from 'vitest';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import { AVATAR_MAX_BYTES, PNG, makeUser, UNKNOWN_ID } from './shared.js';

const REQUEST_URL = '/images/avatars/request-upload';
const confirmUrl = (imageId: string) => `/images/avatars/${imageId}/confirm`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requestUpload(
  env: TestEnv,
  userId: string,
  payload: { mimeType: string; sizeBytes: number } = { mimeType: 'image/png', sizeBytes: PNG.length },
) {
  return env.app.inject({
    method: 'POST',
    url: REQUEST_URL,
    headers: env.authHeaders(userId),
    payload,
  });
}

function confirm(env: TestEnv, userId: string, imageId: string) {
  return env.app.inject({
    method: 'POST',
    url: confirmUrl(imageId),
    headers: env.authHeaders(userId),
  });
}

/** Requests an upload and returns its id and presigned URL. */
async function startUpload(env: TestEnv, userId: string, sizeBytes = PNG.length) {
  const res = await requestUpload(env, userId, { mimeType: 'image/png', sizeBytes });
  expect(res.statusCode).toBe(200);
  return res.json<{ imageId: string; uploadUrl: string }>();
}

// ---------------------------------------------------------------------------
// POST /images/avatars/request-upload
// ---------------------------------------------------------------------------

describe('POST /images/avatars/request-upload', () => {
  test('returns an image id and a presigned URL, and records a pending image', async ({ env }) => {
    const user = await makeUser(env);

    const res = await requestUpload(env, user.id);

    expect(res.statusCode).toBe(200);
    const { imageId, uploadUrl } = res.json();
    expect(imageId).toEqual(expect.any(String));
    expect(uploadUrl).toContain(env.buckets.avatars);

    const image = await env.app.prisma.image.findUniqueOrThrow({
      where: { id: imageId },
      include: { avatar: true },
    });
    expect(image.key.startsWith(`${user.id}/`)).toBe(true);
    expect(image.mimeType).toBe('image/png');
    expect(image.sizeBytes).toBe(PNG.length);
    expect(image.status).toBe('PENDING');
    expect(image.avatar?.userId).toBe(user.id);
  });

  test('400 when the Authorization header is missing (schema validation runs first)', async ({ env }) => {
    const res = await env.app.inject({
      method: 'POST',
      url: REQUEST_URL,
      payload: { mimeType: 'image/png', sizeBytes: 100 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'BadRequest' });
  });

  test('401 when the JWT is invalid', async ({ env }) => {
    const res = await env.app.inject({
      method: 'POST',
      url: REQUEST_URL,
      headers: { authorization: 'Bearer not-a-real-token' },
      payload: { mimeType: 'image/png', sizeBytes: 100 },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  test('400 for an unsupported mime type', async ({ env }) => {
    const user = await makeUser(env);

    const res = await requestUpload(env, user.id, { mimeType: 'image/gif', sizeBytes: 100 });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'BadRequest' });
  });

  test('400 for a negative size', async ({ env }) => {
    const user = await makeUser(env);

    const res = await requestUpload(env, user.id, { mimeType: 'image/png', sizeBytes: -1 });

    expect(res.statusCode).toBe(400);
  });

  test('400 for a missing body field', async ({ env }) => {
    const user = await makeUser(env);

    const res = await env.app.inject({
      method: 'POST',
      url: REQUEST_URL,
      headers: env.authHeaders(user.id),
      payload: { mimeType: 'image/png' },
    });

    expect(res.statusCode).toBe(400);
  });

  test('413 when the declared size exceeds the limit, and nothing is persisted', async ({ env }) => {
    const user = await makeUser(env);

    const res = await requestUpload(env, user.id, {
      mimeType: 'image/png',
      sizeBytes: AVATAR_MAX_BYTES + 1,
    });

    expect(res.statusCode).toBe(413);
    expect(res.json()).toMatchObject({ error: 'PayloadTooLarge' });
    expect(await env.app.prisma.image.count()).toBe(0);
  });

  test('accepts a declared size exactly at the limit', async ({ env }) => {
    const user = await makeUser(env);

    const res = await requestUpload(env, user.id, { mimeType: 'image/png', sizeBytes: AVATAR_MAX_BYTES });

    expect(res.statusCode).toBe(200);
  });

  test('a new request replaces the previous avatar', async ({ env }) => {
    const user = await makeUser(env);

    const first = await startUpload(env, user.id);
    const second = await startUpload(env, user.id);

    expect(await env.app.prisma.avatar.count({ where: { userId: user.id } })).toBe(1);

    const firstImage = await env.app.prisma.image.findUniqueOrThrow({
      where: { id: first.imageId },
      include: { avatar: true },
    });
    const secondImage = await env.app.prisma.image.findUniqueOrThrow({
      where: { id: second.imageId },
      include: { avatar: true },
    });
    expect(firstImage.avatar).toBeNull();
    expect(secondImage.avatar?.userId).toBe(user.id);
  });

  test('does not touch another user\'s avatar', async ({ env }) => {
    const alice = await makeUser(env);
    const bob = await makeUser(env);

    await startUpload(env, alice.id);
    await startUpload(env, bob.id);

    expect(await env.app.prisma.avatar.count({ where: { userId: alice.id } })).toBe(1);
    expect(await env.app.prisma.avatar.count({ where: { userId: bob.id } })).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /images/avatars/:id/confirm
// ---------------------------------------------------------------------------

describe('POST /images/avatars/:id/confirm', () => {
  test('happy path: request, PUT to storage, confirm', async ({ env }) => {
    const user = await makeUser(env);
    const { imageId, uploadUrl } = await startUpload(env, user.id);

    const put = await env.upload(uploadUrl, PNG, 'image/png');
    expect(put.ok).toBe(true);

    const res = await confirm(env, user.id, imageId);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: imageId,
      status: 'UPLOADED',
      mimeType: 'image/png',
      sizeBytes: PNG.length,
      width: 1,
      height: 1,
    });
  });

  test('uses the real object size, not the declared one', async ({ env }) => {
    const user = await makeUser(env);
    const { imageId, uploadUrl } = await startUpload(env, user.id, 999);

    await env.upload(uploadUrl, PNG, 'image/png');
    const res = await confirm(env, user.id, imageId);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ sizeBytes: PNG.length });
  });

  test('is idempotent once uploaded', async ({ env }) => {
    const user = await makeUser(env);
    const { imageId, uploadUrl } = await startUpload(env, user.id);
    await env.upload(uploadUrl, PNG, 'image/png');

    const first = await confirm(env, user.id, imageId);
    const second = await confirm(env, user.id, imageId);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ id: imageId, status: 'UPLOADED' });
  });

  test('401 when the JWT is invalid', async ({ env }) => {
    const res = await env.app.inject({
      method: 'POST',
      url: confirmUrl(UNKNOWN_ID),
      headers: { authorization: 'Bearer not-a-real-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  test('404 for an unknown image id', async ({ env }) => {
    const user = await makeUser(env);

    const res = await confirm(env, user.id, UNKNOWN_ID);

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'NotFound' });
  });

  test('404 when confirming another user\'s image', async ({ env }) => {
    const owner = await makeUser(env);
    const intruder = await makeUser(env);
    const { imageId, uploadUrl } = await startUpload(env, owner.id);
    await env.upload(uploadUrl, PNG, 'image/png');

    const res = await confirm(env, intruder.id, imageId);

    expect(res.statusCode).toBe(404);
    const image = await env.app.prisma.image.findUniqueOrThrow({ where: { id: imageId } });
    expect(image.status).toBe('PENDING');
  });

  test('404 when confirming an image that was replaced by a newer request', async ({ env }) => {
    const user = await makeUser(env);
    const old = await startUpload(env, user.id);
    await env.upload(old.uploadUrl, PNG, 'image/png');
    await startUpload(env, user.id); // replaces the avatar row of the first one

    const res = await confirm(env, user.id, old.imageId);

    expect(res.statusCode).toBe(404);
  });

  test('422 and FAILED when the content does not match the declared type', async ({ env }) => {
    const user = await makeUser(env);
    const { imageId, uploadUrl } = await startUpload(env, user.id, 12);
    await env.upload(uploadUrl, 'not an image', 'image/png');

    const res = await confirm(env, user.id, imageId);

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: 'UnprocessableEntity' });
    const image = await env.app.prisma.image.findUniqueOrThrow({ where: { id: imageId } });
    expect(image.status).toBe('FAILED');
  });

  test('409 when confirming an upload that already failed', async ({ env }) => {
    const user = await makeUser(env);
    const { imageId, uploadUrl } = await startUpload(env, user.id, 12);
    await env.upload(uploadUrl, 'not an image', 'image/png');
    await confirm(env, user.id, imageId); // marks it FAILED

    const res = await confirm(env, user.id, imageId);

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: 'Conflict' });
  });

  test('413 and FAILED when the uploaded object exceeds the limit', async ({ env }) => {
    const user = await makeUser(env);
    // Declare a small size to pass request-upload, then upload something larger.
    const { imageId, uploadUrl } = await startUpload(env, user.id);
    await env.upload(uploadUrl, Buffer.alloc(AVATAR_MAX_BYTES + 1), 'image/png');

    const res = await confirm(env, user.id, imageId);

    expect(res.statusCode).toBe(413);
    expect(res.json()).toMatchObject({ error: 'PayloadTooLarge' });
    const image = await env.app.prisma.image.findUniqueOrThrow({ where: { id: imageId } });
    expect(image.status).toBe('FAILED');
  });

  test('425 when nothing was uploaded to storage yet', async ({ env }) => {
    const user = await makeUser(env);
    const { imageId } = await startUpload(env, user.id);

    const res = await confirm(env, user.id, imageId);

    expect(res.statusCode).toBe(425);
    expect(res.json()).toMatchObject({ error: 'TooEarly' });
  });

  test('stays confirmable after a 425, once the upload actually happens', async ({ env }) => {
    const user = await makeUser(env);
    const { imageId, uploadUrl } = await startUpload(env, user.id);

    await confirm(env, user.id, imageId);
    await env.upload(uploadUrl, PNG, 'image/png');
    const res = await confirm(env, user.id, imageId);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'UPLOADED' });
  });
});
