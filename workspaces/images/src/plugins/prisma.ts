import fp from 'fastify-plugin';
import { createPrismaClient } from '@growthlog/db';

export const prismaPlugin = fp(async (app) => {
  const prisma = createPrismaClient(app.config.DATABASE_URL);

  app.decorate('prisma', prisma);

  app.addHook('onReady', async () => {
    await prisma.$connect();
  });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
