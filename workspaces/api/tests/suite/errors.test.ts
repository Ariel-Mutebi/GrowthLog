import { describe, expect } from 'vitest';
import { test } from '../fixtures.js';
import type { TestEnv } from '../test-env.js';
import { uniqueIp } from '../device.js';
import { ADA_LOGIN } from './helpers/user.js';

/**
 * The central error handler must keep the status code of errors Fastify and its plugins raise
 * themselves (validation, parsing, media type, rate limiting). Only genuine server faults are 500s.
 * These go through app.inject directly because Device always sends well-formed JSON.
 */
const raw = (env: TestEnv, payload: string, contentType: string) =>
  env.app.inject({
    method: 'POST',
    url: '/api/sessions',
    headers: { 'content-type': contentType, 'x-forwarded-for': uniqueIp() },
    payload,
  });

describe('framework-generated errors keep their status', () => {
  test('a schema validation failure is a 400 that names the offending field', async ({ env }) => {
    const res = await env.device().post('/api/sessions', { email: ADA_LOGIN.email });

    expect(res.statusCode, res.body).toBe(400);
    expect(res.json()).toMatchObject({ error: 'BadRequest' });
    expect(res.json().message).toContain('password');
  });

  test('a malformed JSON body is a 400', async ({ env }) => {
    const res = await raw(env, '{"email": ', 'application/json');

    expect(res.statusCode, res.body).toBe(400);
    expect(res.json()).toMatchObject({ error: 'BadRequest' });
  });

  test('an unsupported content type is a 4xx, not a 500', async ({ env }) => {
    const res = await raw(env, 'email=ada@example.com', 'application/x-www-form-urlencoded');

    expect(res.statusCode, res.body).toBe(415);
  });

  test('a validation failure never reveals stack traces or internals', async ({ env }) => {
    const res = await env.device().post('/api/sessions', { email: ADA_LOGIN.email });

    expect(res.body).not.toContain('node_modules');
    expect(res.body).not.toContain('FST_ERR');
    expect(res.json()).not.toHaveProperty('stack');
  });
});
