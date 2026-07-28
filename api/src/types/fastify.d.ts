import 'fastify';
import type { RedisClientType } from 'redis';
import type { Authenticator } from '@fastify/passport';
import type { Role } from '../db/enums.js';
import type { PrismaClient } from '../db/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    auth: Authenticator;
    redis: RedisClientType;
  }
  interface PassportUser {
    id: string;
    role: Role;
  }
}
