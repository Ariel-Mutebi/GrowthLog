import type { FastifyLogFn } from 'fastify';
import type { PrismaClient } from '../../prisma/generated/client.js';

export function buildDeserializeUser(prisma: PrismaClient, logger: FastifyLogFn) {
  return async (id: string) => {
    try {
      return prisma.user.findUnique({
        where: {
          id: Number(id),
        },
      });
    }
    // Keep user logged out if the database/network fails.
    catch (error) {
      logger({ error, id }, 'User deserialization failed');
      return null;
    }
  };
};
