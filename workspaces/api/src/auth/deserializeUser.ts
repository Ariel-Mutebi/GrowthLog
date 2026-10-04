import type { PassportUser } from 'fastify';
import type { PrismaClient } from '@growthlog/db';

export const buildDeserializeUser = (prisma: PrismaClient) =>
  async (serializedUser: PassportUser): Promise<PassportUser | false> => {
    const user = await prisma.user.findUnique({
      where: {
        id: serializedUser.id,
        deletedAt: null,
      },
      select: {
        sessionsRevokedAt: true,
      },
    });

    /*
     * A user session should be revoked if the account was deleted on another device (so user is null),
     * or the password was changed at a time after the session was issued.
    */
    if (!user || user.sessionsRevokedAt && user.sessionsRevokedAt.getTime() >= serializedUser.issuedAt) {
      return false;
    }

    return user ? serializedUser : false;
  };
