import pino from 'pino';
import { createClient } from 'redis';
import { S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '@growthlog/env';
import { createPrismaClient } from '@growthlog/db';

import type { Logger } from 'pino';
import type { RedisClientType } from 'redis';
import type { Config } from './types.js';
import type { PrismaClient } from '@growthlog/db';

class Runtime {
  log: Logger;
  config: Config;
  prisma: PrismaClient;
  redis: RedisClientType;
  minio: S3Client;

  constructor() {
    this.log = pino();

    this.config = loadEnv([
      'REDIS_URL',
      'DATABASE_URL',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
      'FROM_EMAIL',
      'MINIO_ENDPOINT',
      'MINIO_ROOT_USER',
      'MINIO_ROOT_PASSWORD',
      'PUBLIC_IMAGE_BUCKET',
    ]);

    this.prisma = createPrismaClient(this.config.DATABASE_URL);
    this.prisma.$connect();

    this.redis = createClient({ url: this.config.REDIS_URL });

    this.minio = new S3Client({
      endpoint: this.config.MINIO_ENDPOINT,
      forcePathStyle: true,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.config.MINIO_ROOT_USER,
        secretAccessKey: this.config.MINIO_ROOT_PASSWORD,
      },
    });
  }

  async stop() {
    await this.prisma.$disconnect();
    await this.redis.close();
    this.minio.destroy();
  }
}

export const runtime = new Runtime();
