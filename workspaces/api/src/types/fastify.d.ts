import 'fastify';
import type { RedisClientType } from 'redis';
import type { Authenticator } from '@fastify/passport';
import type { PrismaClient } from '@growthlog/db';
import type { AppEnv } from './appEnv.ts';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppEnv;
    auth: Authenticator;
    prisma: PrismaClient;
    redis: RedisClientType;
  }
  interface PassportUser {
    id: string;
    username: string;
  }
}
