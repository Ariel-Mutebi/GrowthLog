import 'fastify';
import type { RedisClientType } from 'redis';
import type { Authenticator } from '@fastify/passport';

import type { Env } from './env.js';
import type { Role } from '../db/enums.js';
import type { PrismaClient } from '../db/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
    auth: Authenticator;
    prisma: PrismaClient;
    redis: RedisClientType;
  }
  interface PassportUser {
    id: string;
    role: Role;
  }
}
