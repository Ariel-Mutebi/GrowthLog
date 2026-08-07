import { globSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { Harness } from './harness.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(join(__dirname, '../.env'));

/**
 * Bootstrap script: starts shared containers, migrates the structure once into
 * a template database, then spawns the test runner as a child process.
 */
const harness = new Harness();
await harness.setup();

const testFiles = globSync('./suite/*.test.ts');
const runner = spawn(
  process.execPath,
  ['--import', 'tsx', '--test', ...testFiles],
  {
    env: {
      PORT: process.env.PORT,
      REDIS_URL: process.env.REDIS_URL,
      DATABASE_URL: process.env.DATABASE_URL,
      SESSION_SECRET: process.env.SESSION_SECRET,
      NODE_ENV: 'test',
      TEST_ADMIN_URL: harness.adminUrl,
      TEST_REDIS_URL: harness.redisUrl,
    },
    stdio: 'inherit',
  },
);

const shutdown = async (code: number | null | undefined = 1) => {
  await harness.teardown();
  process.exit(code);
};

runner.on('close', (code) => shutdown(code));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
