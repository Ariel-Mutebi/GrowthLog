import jwt from 'jsonwebtoken';
import { expect } from 'vitest';
import { test } from '../fixtures.js';
import { signedInDevice } from './helpers/user.js';

test('GET /api/me/jwt rejects an unauthenticated device', async ({ env }) => {
  const res = await env.device().get('/api/me/jwt');
  expect(res.statusCode).toBe(401);
});

test('GET /api/me/jwt returns a five-minute token for the signed-in user', async ({ env }) => {
  const { device, id } = await signedInDevice(env);

  const res = await device.get('/api/me/jwt');
  expect(res.statusCode).toBe(200);

  const claims = jwt.verify(res.json().token, env.app.config.JWT_SECRET) as jwt.JwtPayload;
  expect(claims.sub).toBe(id);
  expect(claims.name).toBe('ada-lovelace');
  expect(claims.exp! - claims.iat!).toBe(60);
});
