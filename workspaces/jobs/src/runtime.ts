import pino, { type Logger } from 'pino';
import { createClient, type RedisClientType } from 'redis';
import { loadEnv } from '@growthlog/env';
import { createPrismaClient, type PrismaClient } from '@growthlog/db';
import type { Config } from './types.js';

class Runtime {
  log: Logger;
  config: Config;
  prisma: PrismaClient;
  redis: RedisClientType;

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
    ]);
    this.prisma = createPrismaClient(this.config.DATABASE_URL);
    this.prisma.$connect();
    this.redis = createClient({ url: this.config.REDIS_URL });
  }

  async stop() {
    await this.prisma.$disconnect();
    await this.redis.close();
  }
}

export const runtime = new Runtime();
