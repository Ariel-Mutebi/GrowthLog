import type { PrismaClient } from '@growthlog/db';

export class ViewService {
  constructor(private readonly prisma: PrismaClient) {}

  public async saveView(postId: string, userId: string, type: 'OPENED' | 'READ') {
    await this.prisma.view.create({
      data: {
        userId,
        postId,
        type,
      },
    });
  }
}
