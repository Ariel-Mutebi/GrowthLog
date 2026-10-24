import { test as base, inject } from 'vitest';
import { TestEnv } from './test-env.js';

export const test = base.extend<{ env: TestEnv; _reset: void }>({
  env: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const env = await TestEnv.create({
        adminUrl: inject('adminUrl'),
        minio: inject('minio'),
      });
      await use(env);
      await env.stop();
    },
    { scope: 'file' },
  ],

  _reset: [
    async ({ env }, use) => {
      await env.reset();
      await use();
    },
    { auto: true },
  ],
});
