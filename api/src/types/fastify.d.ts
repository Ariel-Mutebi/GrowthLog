import 'fastify';
import type { PrismaClient } from '../../prisma/generated/client.js';
import type { Authenticator } from '@fastify/passport';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    auth: Authenticator;
  }
}
