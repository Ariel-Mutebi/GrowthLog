import 'fastify';
import type { RedisClientType } from 'redis';
import type { Authenticator } from '@fastify/passport';
import type { PrismaClient } from '@growthlog/db';
import type { Config } from './config.ts';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    auth: Authenticator;
    prisma: PrismaClient;
    redis: RedisClientType;
  }
  interface PassportUser {
    id: string;
    username: string;
  }
}
