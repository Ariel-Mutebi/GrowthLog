import { randomBytes } from 'node:crypto';
import { buildApp } from '../src/app.js';
import type { FastifyInstance } from 'fastify';
import { runSql, withDatabase, TEMPLATE_DB } from './database.js';
import { Device } from './device.js';

/** Admin URL against the container's default database, for CREATE/DROP DATABASE. */
export interface TestEnvOptions {
  adminUrl: string;
  redisUrl: string;
}

/**
 * Per-file lifecycle: clones the template database, boots the app against it
 * with a Redis key prefix, and tears both down afterwards.
 */
export class TestEnv {
  private constructor(
    readonly app: FastifyInstance,
    readonly redisPrefix: string,
    private readonly database: string,
    private readonly adminUrl: string,
  ) { }

  static async create({ adminUrl, redisUrl }: TestEnvOptions): Promise<TestEnv> {
    const database = `test_${randomBytes(8).toString('hex')}`;
    const redisPrefix = `${database}:`;
    await runSql(adminUrl, `CREATE DATABASE "${database}" TEMPLATE "${TEMPLATE_DB}";`);

    const app = buildApp({
      NODE_ENV: 'test',
      REDIS_URL: redisUrl,
      REDIS_KEY_PREFIX: redisPrefix,
      SESSION_SECRET: randomBytes(32).toString('hex'),
      DATABASE_URL: `${withDatabase(adminUrl, database)}?connection_limit=2`,
    });
    await app.ready();

    return new TestEnv(app, redisPrefix, database, adminUrl);
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
      await runSql(this.adminUrl, `DROP DATABASE IF EXISTS "${this.database}";`);
    } catch (reason) {
      console.error('Teardown error (drop database):', reason);
    }
  }

  device(ip?: string) {
    return new Device(this.app, ip);
  }
}
