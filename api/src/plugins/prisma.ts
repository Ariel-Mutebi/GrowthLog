import fp from 'fastify-plugin';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../prisma/generated/client.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prismaPlugin = fp(async (app) => {
  const prisma = new PrismaClient({ adapter });
  app.decorate('prisma', prisma);

  app.addHook('onReady', async () => {
    await prisma.$connect();
  });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
