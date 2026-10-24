import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import type { TestProject } from 'vitest/node';
import { MinioContainer } from '@testcontainers/minio';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { runSql, withDatabase, TEMPLATE_DB } from './database.js';

const exec = promisify(execFile);

export default async function setup(project: TestProject) {
  const minioUser = randomBytes(32).toString('hex');
  const minioPassword = randomBytes(32).toString('hex');

  const [pg, minio] = await Promise.all([
    new PostgreSqlContainer('postgres:18').start(),
    new MinioContainer('pgsty/minio:latest')
      .withUsername(minioUser)
      .withPassword(minioPassword)
      .start(),
  ]);

  const adminUrl = pg.getConnectionUri();
  await runSql(adminUrl, `CREATE DATABASE "${TEMPLATE_DB}";`);

  await exec('pnpm', ['--filter', '@growthlog/db', 'run', 'migrate:deploy'], {
    env: { ...process.env, DATABASE_URL: withDatabase(adminUrl, TEMPLATE_DB) },
  });

  project.provide('adminUrl', adminUrl);
  project.provide('minio', {
    endpoint: minio.getConnectionUrl(),
    user: minio.getUsername(),
    password: minio.getPassword(),
  });

  return () => Promise.allSettled([pg.stop(), minio.stop()]);
}
