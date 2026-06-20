import { globSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { Harness } from './harness.ts';

/**
 * Bootstrap script: starts shared containers, migrates the structure once into
 * a template database, then spawns the test runner as a child process.
 */
const harness = new Harness();
await harness.setup();

const testFiles = globSync('tests/**/*.test.ts');
const runner = spawn(
  process.execPath,
  ['--import', 'tsx', '--test', ...testFiles],
  {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_ADMIN_URL: harness.adminUrl,
      TEST_REDIS_URL: harness.redisUrl,
    },
    stdio: 'inherit',
  },
);

const shutdown = async (code: number) => {
  await harness.teardown();
  process.exit(code);
};

runner.on('close', (code) => shutdown(code ?? 1));

// Clean up containers if the process is interrupted mid-run.
process.on('SIGINT', () => shutdown(1));
process.on('SIGTERM', () => shutdown(1));
