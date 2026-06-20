import fp from 'fastify-plugin';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../db/client.js';

export const prismaPlugin = fp(async (app) => {
  const connection = process.env.DATABASE_URL;
  const options: { schema?: string } = {};

  /**
   * Concurrently running test files use multiple schemas on the same database
   * connection to achieve both isolation and efficiency.
  */
  if (process.env.NODE_ENV == 'test' && connection) {
    options.schema = new URL(connection).searchParams.get('schema') ?? undefined;
  }

  const adapter = new PrismaPg({ connectionString: connection }, options);
  const prisma = new PrismaClient({ adapter });

  app.decorate('prisma', prisma);

  app.addHook('onReady', async () => {
    await prisma.$connect();
  });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
