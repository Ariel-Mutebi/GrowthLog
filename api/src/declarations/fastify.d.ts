import 'fastify';
import type { RedisClientType } from 'redis';
import type { Authenticator } from '@fastify/passport';

import type { Env } from '../typebox/env.ts';
import type { Role } from '../db/enums.ts';
import type { PrismaClient } from '../db/client.ts';

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
