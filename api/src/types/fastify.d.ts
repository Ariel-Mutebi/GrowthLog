import 'fastify';
import type { createClient } from 'redis';
import type { Authenticator } from '@fastify/passport';
import type { Role } from '../db/enums.js';
import type { PrismaClient } from '../db/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    auth: Authenticator;
    redis: ReturnType<typeof createClient>;
  }
  interface PassportUser {
    id: string;
    role: Role;
  }
}
