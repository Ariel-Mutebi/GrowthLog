import fp from 'fastify-plugin';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../db/client.js';

export const prismaPlugin = fp(async (app) => {
  const adapter = new PrismaPg({ connectionString: app.config.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  app.decorate('prisma', prisma);

  app.addHook('onReady', async () => {
    await prisma.$connect();
  });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
