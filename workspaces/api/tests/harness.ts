import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Client } from 'pg';
import { buildApp } from '../src/app.js';

const exec = promisify(execFile);

/**
 * One Postgres and one Redis container serve the entire test run. The table
 * structure is migrated once into a template database; each test file then
 * clones that template at the filesystem level into its own database and scopes
 * Redis with a key prefix, so files run in parallel without sharing state.
 */

const TEMPLATE_DB = 'growthlog_template';

/** Runs raw SQL against a Postgres connection. */
async function runSql(connectionString: string, sql: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/** Returns the connection URL with its pathname swapped to a different database. */
function withDatabase(baseUrl: string, dbName: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/**
 * Global lifecycle — one instance in setup.ts, runs before the test runner.
 */
export class Harness {
  /** Admin URL against the container's default database, for CREATE DATABASE. */
  adminUrl!: string;
  redisUrl!: string;

  private pg?: StartedPostgreSqlContainer;
  private redis?: StartedRedisContainer;

  async setup(): Promise<void> {
    [this.pg, this.redis] = await Promise.all([
      new PostgreSqlContainer('postgres:18').start(),
      new RedisContainer('redis:7').start(),
    ]);
    this.adminUrl = this.pg.getConnectionUri();
    this.redisUrl = this.redis.getConnectionUrl();

    // Migrate the canonical structure once into a dedicated template database.
    const templateUrl = withDatabase(this.adminUrl, TEMPLATE_DB);
    await runSql(this.adminUrl, `CREATE DATABASE "${TEMPLATE_DB}";`);
    await exec('pnpm', ['exec', 'prisma', 'db', 'push', '--url', templateUrl]);
  }

  async teardown(): Promise<void> {
    await Promise.allSettled([this.pg?.stop(), this.redis?.stop()]);
  }
}

/**
 * Per-file lifecycle — one instance per test file.
 */
export class TestEnv {
  app!: FastifyInstance;
  database!: string;
  redisPrefix!: string;

  async start(): Promise<void> {
    const adminUrl = process.env.TEST_ADMIN_URL;
    const redisUrl = process.env.TEST_REDIS_URL;
    if (!adminUrl) throw new Error('TEST_ADMIN_URL not set — Harness.setup() did not run.');
    if (!redisUrl) throw new Error('TEST_REDIS_URL not set — Harness.setup() did not run.');

    this.database = `test_${randomBytes(8).toString('hex')}`;
    this.redisPrefix = `${this.database}:`;
    await runSql(adminUrl, `CREATE DATABASE "${this.database}" TEMPLATE "${TEMPLATE_DB}";`);

    this.app = buildApp({
      NODE_ENV: 'test',
      REDIS_URL: redisUrl,
      REDIS_KEY_PREFIX: this.redisPrefix,
      SESSION_SECRET: randomBytes(32).toString('hex'),
      DATABASE_URL: `${withDatabase(adminUrl, this.database)}?connection_limit=2`,
    });
    await this.app.ready();
  }

  /** Empties every table in this file's database and clears its Redis keys. */
  async reset(): Promise<void> {
    const tables: { tablename: string }[] = await this.app.prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public';
    `;

    if (tables.length) {
      const names = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
      await this.app.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE;`);
    }

    const keys = await this.app.redis.keys(`${this.redisPrefix}*`);
    if (keys.length) await this.app.redis.del(keys);
  }
  
  async stop(): Promise<void> {
    try {
      await this.app?.close();
    } catch (reason) {
      console.error('Teardown error (app close):', reason);
    }
    try {
      await runSql(
        process.env.TEST_ADMIN_URL!,
        `DROP DATABASE IF EXISTS "${this.database}";`,
      );
    } catch (reason) {
      console.error('Teardown error (drop database):', reason);
    }
  }
}
