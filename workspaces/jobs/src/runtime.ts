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
  storage: S3Client;

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
      'STORAGE_ENDPOINT',
      'STORAGE_REGION',
      'STORAGE_ACCESS_KEY_ID',
      'STORAGE_SECRET_ACCESS_KEY',
      'PUBLIC_IMAGE_BUCKET',
    ]);

    this.prisma = createPrismaClient(this.config.DATABASE_URL);
    this.prisma.$connect();

    this.redis = createClient({ url: this.config.REDIS_URL });

    this.storage = new S3Client({
      endpoint: this.config.STORAGE_ENDPOINT,
      region: this.config.STORAGE_REGION,
      credentials: {
        accessKeyId: this.config.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: this.config.STORAGE_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  async stop() {
    await this.prisma.$disconnect();
    await this.redis.close();
    this.storage.destroy();
  }
}

export const runtime = new Runtime();
