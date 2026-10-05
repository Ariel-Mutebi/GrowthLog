import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/suite/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    execArgv: ['--import', 'tsx'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
