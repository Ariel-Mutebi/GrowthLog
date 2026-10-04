import { test as base, inject } from 'vitest';
import { TestEnv } from './test-env.js';

export const test = base.extend<{ env: TestEnv; _reset: void }>({
  // Built once per test file: clone the template DB, boot the app.
  env: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const env = await TestEnv.create({
        adminUrl: inject('adminUrl'),
        redisUrl: inject('redisUrl'),
      });
      await use(env);
      await env.stop();
    },
    { scope: 'file' },
  ],

  // Runs before every test automatically.
  _reset: [
    async ({ env }, use) => {
      await env.reset();
      await use();
    },
    { auto: true },
  ],
});
