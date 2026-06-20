import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { Client } from 'pg';

const exec = promisify(execFile);

/**
 * One Postgres and one Redis container serve the entire test run. The table
 * structure is migrated once into the public schema and captured as schema-less
 * DDL. Each test file then stamps that DDL into its own Postgres schema and
 * scopes Redis with a key prefix — both derived from one unique name — so files
 * run in parallel without sharing state.
 */

/** Runs raw SQL against a Postgres connection, optionally scoped to a schema. */
async function runSql(connectionString: string, sql: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/**
 * Strips pg_dump's own search_path directives and public-schema qualifiers,
 * leaving DDL whose object names resolve against whatever search_path is active
 * at replay time. The leading SET makes that target explicit per file.
 */
function reschematize(dump: string, schema: string): string {
  const stripped = dump
    // psql meta-commands (\restrict, \unrestrict, \connect) are client
    // directives, not SQL — the pg driver would choke on the leading backslash.
    .replace(/^\s*\\.*$/gm, '')
    // pg_dump emits this to pin objects to public; we want them unqualified.
    .replace(/^SELECT pg_catalog\.set_config\('search_path'.*$/gm, '')
    .replace(/^SET search_path = .*$/gm, '')
    // Remove the public. qualifier so unqualified names follow search_path.
    .replace(/\bpublic\./g, '')
    // CREATE SCHEMA public / comments on it are noise here.
    .replace(/^CREATE SCHEMA public;$/gm, '')
    .replace(/^COMMENT ON SCHEMA public .*$/gm, '');

  return `SET search_path TO "${schema}";\n${stripped}`;
}

/**
 * Global lifecycle — one instance in setup.ts, runs before the test runner.
 */
export class Harness {
  databaseUrl!: string;
  redisUrl!: string;
  ddlPath!: string;

  private pg?: StartedPostgreSqlContainer;
  private redis?: StartedRedisContainer;

  async setup(): Promise<void> {
    [this.pg, this.redis] = await Promise.all([
      new PostgreSqlContainer('postgres:18').start(),
      new RedisContainer('redis:7').start(),
    ]);
    this.databaseUrl = this.pg.getConnectionUri();
    this.redisUrl = this.redis.getConnectionUrl();

    // Migrate the canonical structure a single time into public.
    await exec('npx', ['prisma', 'db', 'push', '--url', this.databaseUrl]);

    // Capture schema-only DDL once; every test file replays this same text.
    const { stdout, stderr, exitCode } = await this.pg.exec([
      'pg_dump',
      '--username', this.pg.getUsername(),
      '--dbname', this.pg.getDatabase(),
      '--schema-only',
      '--schema=public',
      '--no-owner',
      '--no-privileges',
      '--no-tablespaces',
    ]);
    if (exitCode !== 0) {
      throw new Error(`pg_dump failed (exit ${exitCode}): ${stderr}`);
    }

    this.ddlPath = join(tmpdir(), `growthlog-ddl-${randomUUID()}.sql`);
    await writeFile(this.ddlPath, stdout, 'utf8');
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
  schema!: string;
  databaseUrl!: string;
  redisPrefix!: string;

  private tables: string[] = [];

  async start(): Promise<void> {
    const baseUrl = process.env.TEST_DATABASE_URL;
    const redisUrl = process.env.TEST_REDIS_URL;
    const ddlPath = process.env.TEST_DDL_PATH;
    if (!baseUrl) throw new Error('TEST_DATABASE_URL not set — Harness.setup() did not run.');
    if (!redisUrl) throw new Error('TEST_REDIS_URL not set — Harness.setup() did not run.');
    if (!ddlPath) throw new Error('TEST_DDL_PATH not set — Harness.setup() did not run.');

    this.schema = `test_${randomUUID().replace(/-/g, '')}`;
    this.redisPrefix = `${this.schema}:`;

    const urlObject = new URL(baseUrl);
    urlObject.searchParams.set('schema', this.schema);
    this.databaseUrl = urlObject.toString();

    // Create the namespace, then replay the captured blueprint into it.
    const dump = await readFile(ddlPath, 'utf8');
    await runSql(baseUrl, `CREATE SCHEMA IF NOT EXISTS "${this.schema}";`);
    await runSql(this.databaseUrl, reschematize(dump, this.schema));

    this.tables = await this.listTables(baseUrl);

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

  /** All base-table names in this file's schema, for a complete truncate. */
  private async listTables(baseUrl: string): Promise<string[]> {
    const client = new Client({ connectionString: baseUrl });
    await client.connect();
    try {
      const { rows } = await client.query<{ tablename: string }>(
        'SELECT tablename FROM pg_tables WHERE schemaname = $1;',
        [this.schema],
      );
      return rows.map((r) => r.tablename);
    } finally {
      await client.end();
    }
  }

  /** Truncates every table in this file's schema and clears its Redis keys. */
  async reset(): Promise<void> {
    if (this.tables.length > 0) {
      const list = this.tables.map((t) => `"${this.schema}"."${t}"`).join(', ');
      await this.app.prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`,
      );
    }

    const keys: string[] = [];
    for await (const batch of this.app.redis.scanIterator({ MATCH: `${this.redisPrefix}*`, COUNT: 100 })) {
      keys.push(...batch);
    }
    if (keys.length > 0) await this.app.redis.del(keys);
  }

  async stop(): Promise<void> {
    const results = await Promise.allSettled([
      this.app?.close(),
      runSql(process.env.TEST_DATABASE_URL!, `DROP SCHEMA IF EXISTS "${this.schema}" CASCADE;`),
    ]);
    for (const r of results) {
      if (r.status === 'rejected') console.error('Teardown error:', r.reason);
    }
  }
}
