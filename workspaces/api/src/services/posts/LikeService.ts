import { PrismaClientKnownRequestError } from '@growthlog/db';
import { PostNotFoundError } from './shared/errors.js';
import type { PrismaClient } from '@growthlog/db';

export class LikeService {
  constructor (private readonly prisma: PrismaClient) {}

  public async like(postId: string, userId: string) {
    try {
      await this.prisma.like.upsert({
        where: { userId_postId: { userId, postId } },
        create: { userId, postId },
        update: {},
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }

      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new PostNotFoundError();
      }

      throw error;
    }
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
