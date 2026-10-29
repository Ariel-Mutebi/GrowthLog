import { randomBytes } from 'node:crypto';
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { runSql, withDatabase, TEMPLATE_DB } from './database.js';

export interface MinioOptions {
  endpoint: string;
  user: string;
  password: string;
}

export interface TestEnvOptions {
  adminUrl: string;
  minio: MinioOptions;
}

/**
 * Per-file lifecycle: clones the template database, creates this file's
 * buckets, boots the app against both, and tears them down afterwards.
 */
export class TestEnv {
  private constructor(
    readonly app: FastifyInstance,
    readonly s3: S3Client,
    readonly buckets: { avatars: string; images: string },
    private readonly database: string,
    private readonly adminUrl: string,
  ) { }

  static async create({ adminUrl, minio }: TestEnvOptions): Promise<TestEnv> {
    const id = randomBytes(8).toString('hex');
    const database = `test_${id}`;
    const buckets = { avatars: `avatars-${id}`, images: `images-${id}` };

    await runSql(adminUrl, `CREATE DATABASE "${database}" TEMPLATE "${TEMPLATE_DB}";`);

    const s3 = new S3Client({
      endpoint: minio.endpoint,
      forcePathStyle: true,
      region: 'us-east-1',
      credentials: { accessKeyId: minio.user, secretAccessKey: minio.password },
    });
    await s3.send(new CreateBucketCommand({ Bucket: buckets.avatars }));
    await s3.send(new CreateBucketCommand({ Bucket: buckets.images }));

    const app = buildApp({
      NODE_ENV: 'test',
      IMAGES_PORT: 0,
      JWT_SECRET: randomBytes(32).toString('hex'),
      DATABASE_URL: `${withDatabase(adminUrl, database)}?connection_limit=2`,
      STORAGE_ENDPOINT: minio.endpoint,
      STORAGE_REGION: 'us-east-1',
      PUBLIC_STORAGE_ENDPOINT: minio.endpoint,
      STORAGE_ACCESS_KEY_ID: minio.user,
      STORAGE_SECRET_ACCESS_KEY: minio.password,
      PUBLIC_AVATAR_BUCKET: buckets.avatars,
      PUBLIC_IMAGE_BUCKET: buckets.images,
      PUBLIC_MAX_AVATAR_SIZE_BYTES: 1024 * 1024,
      PUBLIC_MAX_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,
      PRESIGNED_URL_EXPIRY_SECONDS: 300,
    });
    await app.ready();

    return new TestEnv(app, s3, buckets, database, adminUrl);
  }

  /** Empties every table in this file's database and every object in its buckets. */
  async reset(): Promise<void> {
    const tables: { tablename: string }[] = await this.app.prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public';
    `;

    if (tables.length) {
      const names = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
      await this.app.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE;`);
    }

    for (const Bucket of Object.values(this.buckets)) {
      const { Contents } = await this.s3.send(new ListObjectsV2Command({ Bucket }));
      if (Contents?.length) {
        await this.s3.send(new DeleteObjectsCommand({
          Bucket,
          Delete: { Objects: Contents.map(({ Key }) => ({ Key })) },
        }));
      }
    }
  }

  async stop(): Promise<void> {
    try {
      await this.app?.close();
    } catch (reason) {
      console.error('Teardown error (app close):', reason);
    }
    try {
      this.s3.destroy();
      await runSql(this.adminUrl, `DROP DATABASE IF EXISTS "${this.database}";`);
    } catch (reason) {
      console.error('Teardown error (drop database):', reason);
    }
  }

  authHeaders(userId: string) {
    return { authorization: `Bearer ${this.app.jwt.sign({ sub: userId, name: 'Test User' })}` };
  }

  /** Simulates the client uploading straight to storage via a presigned URL. */
  upload(url: string, body: Buffer | string, contentType: string) {
    return fetch(url, {
      method: 'PUT',
      body: typeof body === 'string' ? body : new Uint8Array(body),
      headers: { 'Content-Type': contentType },
    });
  }
}
