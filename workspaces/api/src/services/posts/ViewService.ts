import { PrismaClientKnownRequestError } from '@growthlog/db';
import { PostNotFoundError } from './shared/errors.js';
import type { PrismaClient } from '@growthlog/db';

export class ViewService {
  constructor(private readonly prisma: PrismaClient) {}

  public async saveView(postId: string, userId: string, type: 'OPENED' | 'READ') {
    try {
      await this.prisma.view.create({
        data: {
          userId,
          postId,
          type,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new PostNotFoundError();
      }

      throw error;
    }
  }
}
