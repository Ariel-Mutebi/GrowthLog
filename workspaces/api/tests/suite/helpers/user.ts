import { expect } from 'vitest';
import type { TestEnv } from '../../test-env.js';
import type { Device } from '../../device.js';

export const SESSION = 'sessionId';
export const STRONG_PASSWORD = 'correct-horse-battery-staple-92';
export const WRONG_PASSWORD = 'atrociously-wrong-password-here-123';
export const ADA_LOGIN = { email: 'ada@example.com', password: STRONG_PASSWORD };

export const newUser = (over: Partial<Record<string, string>> = {}) => ({
  forename: 'Ada',
  surname: 'Lovelace',
  username: 'ada-lovelace',
  ...ADA_LOGIN,
  ...over,
});

/** Registers a user, asserting success, and returns the new user's id. */
export async function register(device: Device, over: Partial<Record<string, string>> = {}): Promise<string> {
  const res = await device.post('/api/users', newUser(over));
  expect(res.statusCode, `registration failed: ${res.body}`).toBe(201);
  return res.json().id;
}

/** Registers a user on a fresh device. Registration opens a session, so the device is signed in. */
export async function signedInDevice(env: TestEnv, over: Partial<Record<string, string>> = {}) {
  const device = env.device();
  const id = await register(device, over);
  expect(device.cookies.has(SESSION), 'registration should open a session').toBe(true);
  return { device, id };
}
