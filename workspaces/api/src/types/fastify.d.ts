import 'fastify';
import type { RedisClientType } from 'redis';
import type { Authenticator } from '@fastify/passport';
import type { PrismaClient } from '@growthlog/db';

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      API_PORT: number;
      REDIS_URL: string;
      DATABASE_URL: string;
      JWT_SECRET: string;
      SESSION_SECRET: string;
      NODE_ENV: 'development' | 'production' | 'test';
      REDIS_KEY_PREFIX?: string; // used only in test env
    };
    auth: Authenticator;
    prisma: PrismaClient;
    redis: RedisClientType;
  }
  interface PassportUser {
    id: string;
    username: string;
  }
}
