import pino, { type Logger } from 'pino';
import { createClient, type RedisClientType } from 'redis';
import { loadEnv } from '@growthlog/env';
import { createPrismaClient, type PrismaClient } from '@growthlog/db';

interface Config {
  REDIS_URL: string;
  DATABASE_URL: string;
}

class Runtime {
  log: Logger;
  config: Config;
  prisma: PrismaClient;
  redis: RedisClientType;

  constructor() {
    this.log = pino();
    this.config = loadEnv(['REDIS_URL', 'DATABASE_URL']);
    this.prisma = createPrismaClient(this.config.DATABASE_URL);
    this.prisma.$connect();
    this.redis = createClient({ url: this.config.REDIS_URL });
  }
}

export const runtime = new Runtime();
