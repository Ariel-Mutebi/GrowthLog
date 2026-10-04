import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/suite/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    hookTimeout: 30_000,
    execArgv: ['--import', 'tsx'],
  },
});
