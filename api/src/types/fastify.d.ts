import 'fastify';
import type { PrismaClient } from '../db/client.js';
import type { Authenticator } from '@fastify/passport';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    auth: Authenticator;
  }
}
