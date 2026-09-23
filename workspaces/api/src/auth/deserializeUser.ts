import type { PassportUser } from 'fastify';
import type { PrismaClient } from '../db/client.js';

/**
 * Confirms the session's user wasn't deleted; returns false in case it was.
 * If a user was logged in on device A and B, and he deleted his account on
 * device A, the cookie is cleared on device A, but without the DB check in
 * the deserializer, he could just use device B with it's old session cookie.
 */
export const buildDeserializeUser =
  (prisma: PrismaClient) =>
    async (serializedUser: PassportUser): Promise<PassportUser | false> => {
      const user = await prisma.user.findUnique({
        where: {
          id: serializedUser.id,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      return user ? serializedUser : false;
    };
