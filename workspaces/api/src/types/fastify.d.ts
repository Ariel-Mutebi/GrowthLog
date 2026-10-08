import 'fastify';
import type { RedisClientType } from 'redis';
import type { Authenticator } from '@fastify/passport';
import type { PrismaClient } from '@growthlog/db';
import type { Emailer } from '@growthlog/jobs';
import type { Config } from './config.ts';

declare module 'fastify' {
  interface FastifyInstance {
    auth: Authenticator;
    config: Config;
    emailer: Emailer;
    prisma: PrismaClient;
    redis: RedisClientType;
  }
  interface PassportUser {
    id: string;
    username: string;
    issuedAt: number; // when the session was issued (ms since epoch)
  }
}
