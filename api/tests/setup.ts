import { globSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { Harness } from './harness.ts';

/**
 * Bootstrap script: starts shared containers, migrates and captures the schema
 * once, then spawns the test runner as a child process. Container URLs and the
 * captured-DDL path travel in the child's environment; test file processes
 * inherit them.
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
      TEST_DATABASE_URL: harness.databaseUrl,
      TEST_REDIS_URL: harness.redisUrl,
      TEST_DDL_PATH: harness.ddlPath,
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
