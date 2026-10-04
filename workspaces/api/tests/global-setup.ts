import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import type { TestProject } from 'vitest/node';
import { RedisContainer } from '@testcontainers/redis';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { runSql, withDatabase, TEMPLATE_DB } from './database.js';

const exec = promisify(execFile);

export default async function setup(project: TestProject) {
  const [pg, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:18').start(),
    new RedisContainer('redis:7').start(),
  ]);

  const adminUrl = pg.getConnectionUri();
  await runSql(adminUrl, `CREATE DATABASE "${TEMPLATE_DB}";`);

  await exec('pnpm', ['--filter', '@growthlog/db', 'run', 'migrate:deploy'], {
    env: { ...process.env, DATABASE_URL: withDatabase(adminUrl, TEMPLATE_DB) },
  });

  project.provide('adminUrl', adminUrl);
  project.provide('redisUrl', redis.getConnectionUrl());

  return () => Promise.allSettled([pg.stop(), redis.stop()]);
}
