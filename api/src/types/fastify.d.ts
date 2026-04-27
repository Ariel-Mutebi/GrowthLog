import 'fastify';
import { PrismaClient } from '../../prisma/generated/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}
