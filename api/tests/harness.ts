import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Client } from 'pg';

const exec = promisify(execFile);

/**
 * One Postgres and one Redis container serve the entire test run. Each test file
 * gets its own Postgres schema and Redis key prefix — both derived from the same
 * unique name and injected via env — so files run in parallel without sharing state.
 */

/** Runs raw SQL against the base (schema-less) Postgres connection. */
async function runSql(sql: string): Promise<void> {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL! });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
/**
 * Global lifecycle — one instance in setup.ts, runs before the test runner
 */
export class Harness {
  databaseUrl!: string;
  redisUrl!: string;

  private pg?: StartedPostgreSqlContainer;
  private redis?: StartedRedisContainer;

  async setup(): Promise<void> {
    [this.pg, this.redis] = await Promise.all([
      new PostgreSqlContainer('postgres:18').start(),
      new RedisContainer('redis:7').start(),
    ]);

    this.databaseUrl = this.pg.getConnectionUri();
    this.redisUrl = this.redis.getConnectionUrl();
  }

  async teardown(): Promise<void> {
    await Promise.allSettled([this.pg?.stop(), this.redis?.stop()]);
  }
}

/**
 * Per-file lifecycle — one instance per test file
 */
export class TestEnv {
  app!: FastifyInstance;
  schema!: string;
  databaseUrl!: string;
  redisPrefix!: string;

  async start(): Promise<void> {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;
    const redisUrl = process.env.TEST_REDIS_URL;
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL not set — Harness.setup() did not run.');
    if (!redisUrl) throw new Error('TEST_REDIS_URL not set — Harness.setup() did not run.');

    this.schema = `test_${randomUUID().replace(/-/g, '')}`;
    this.redisPrefix = `${this.schema}:`;

    const databaseUrlObject = new URL(testDatabaseUrl);
    databaseUrlObject.searchParams.set('schema', this.schema);
    this.databaseUrl = databaseUrlObject.toString();

    await runSql(`CREATE SCHEMA IF NOT EXISTS "${this.schema}";`);
    await exec('npx', ['prisma', 'db', 'push', '--url', this.databaseUrl]);

    // Env must be set BEFORE the app is imported, since plugins read it at load.
    process.env.DATABASE_URL = this.databaseUrl;
    process.env.REDIS_URL = redisUrl;
    process.env.REDIS_KEY_PREFIX = this.redisPrefix;
    process.env.SESSION_SECRET = 'DoNotTryAndBendTheSpoonThatIsImpossible';
    process.env.NODE_ENV = 'test';

    const { buildApp } = await import('../src/app.js');
    this.app = buildApp();
    await this.app.ready();
  }

  /** Truncates this file's tables and deletes its Redis keys between tests. */
  async reset(): Promise<void> {
    await this.app.prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "${this.schema}"."User" RESTART IDENTITY CASCADE;`,
    );

    const keys: string[] = [];
    for await (const batch of this.app.redis.scanIterator({ MATCH: `${this.redisPrefix}*`, COUNT: 100 })) {
      keys.push(...batch);
    }
    if (keys.length > 0) await this.app.redis.del(keys);
  }

  async stop(): Promise<void> {
    const results = await Promise.allSettled([
      this.app?.close(),
      runSql(`DROP SCHEMA IF EXISTS "${this.schema}" CASCADE;`),
    ]);

    for (const r of results) {
      if (r.status === 'rejected') console.error('Teardown error:', r.reason);
    }
  }
}
