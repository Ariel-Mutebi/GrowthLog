// tests/suite/me-email.test.ts
import { expect, vi } from 'vitest';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import type { Device } from '../device.js';
import { signedInDevice } from './helpers/user.js';

const REQUEST = '/api/me/email/request-verification';
const CONFIRM = '/api/me/email/confirm-token';

/** Requests a code and captures it from the (stubbed) emailer, since only its hash is stored. */
async function requestCode(env: TestEnv, device: Device) {
  const send = vi.spyOn(env.app.emailer, 'sendVerificationEmail').mockResolvedValue(undefined);
  try {
    const res = await device.post(REQUEST);
    expect(res.statusCode).toBe(204);
    expect(send).toHaveBeenCalledOnce();
    return send.mock.calls[0]![0] as { userId: string; code: string };
  } finally {
    send.mockRestore();
  }
}

const isVerified = async (env: TestEnv, id: string) =>
  (await env.app.prisma.user.findUniqueOrThrow({ where: { id } })).emailVerifiedAt !== null;

test.for([REQUEST, CONFIRM])('POST %s rejects an unauthenticated device', async (url, { env }) => {
  const res = await env.device().post(url, url === CONFIRM ? { code: '123456' } : undefined);
  expect(res.statusCode).toBe(401);
});

test('request-verification emails a six-digit code to the user', async ({ env }) => {
  const { device, id } = await signedInDevice(env);

  const sent = await requestCode(env, device);
  expect(sent.userId).toBe(id);
  expect(sent.code).toMatch(/^\d{6}$/);
});

test('confirm-token verifies the email, and the code is single-use', async ({ env }) => {
  const { device, id } = await signedInDevice(env);
  const { code } = await requestCode(env, device);

  expect((await device.post(CONFIRM, { code })).statusCode).toBe(204);
  expect(await isVerified(env, id)).toBe(true);

  expect((await device.post(CONFIRM, { code })).statusCode).toBe(400);
});

test('confirm-token rejects a wrong code', async ({ env }) => {
  const { device, id } = await signedInDevice(env);
  await requestCode(env, device);

  // Codes are 100000-999999, so this can never be valid.
  const res = await device.post(CONFIRM, { code: '000000' });
  expect(res.statusCode).toBe(400);
  expect(await isVerified(env, id)).toBe(false);
});

test('confirm-token rejects an expired code', async ({ env }) => {
  const { device, id } = await signedInDevice(env);
  const { code } = await requestCode(env, device);

  await env.app.prisma.emailVerificationCode.updateMany({
    where: { userId: id },
    data: { expiresAt: new Date(0) },
  });

  expect((await device.post(CONFIRM, { code })).statusCode).toBe(400);
  expect(await isVerified(env, id)).toBe(false);
});

test('requesting a new code invalidates the previous one', async ({ env }) => {
  const { device } = await signedInDevice(env);
  const first = await requestCode(env, device);
  const second = await requestCode(env, device);

  expect((await device.post(CONFIRM, { code: first.code })).statusCode).toBe(400);
  expect((await device.post(CONFIRM, { code: second.code })).statusCode).toBe(204);
});
