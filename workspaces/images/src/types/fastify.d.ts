import 'fastify';
import type { PrismaClient } from '@growthlog/db';
import type { Config } from './config.ts';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    config: Config;
  }
}
