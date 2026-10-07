import type { PrismaClient } from '@growthlog/db';

/** Hard-delete users who were soft-deleted seven or more days ago. */
export async function grimReaper(prisma: PrismaClient) {
  const bellToll = new Date();
  bellToll.setDate(bellToll.getDate() - 7);

  const fallen = await prisma.user.deleteMany({
    where: {
      deletedAt: {
        lte: bellToll,
      },
    },
  });

  return fallen.count;
}

