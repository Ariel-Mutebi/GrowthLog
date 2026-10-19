import type { PrismaClient } from '@growthlog/db';

export class LikeService {
  constructor (private readonly prisma: PrismaClient) {}

  public async like(postId: string, userId: string) {
    await this.prisma.like.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });
  }

  public async unlike(postId: string, userId: string) {
    await this.prisma.like.deleteMany({
      where: {
        postId,
        userId,
      },
    });
  }
}
