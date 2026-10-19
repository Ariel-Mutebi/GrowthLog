import { PostNotFoundError } from './shared/errors.js';
import { publicSelect } from '../users/shared/selectors.js';
import { flattenAvatarKey } from '../users/shared/helpers.js';

import type { PrismaClient } from '@growthlog/db';
import type { PublicUser } from '../users/shared/interfaces.js';

export interface ReadingView {
  id: string;
  title: string;
  author: PublicUser;
  likes: number;
  comments: number;
  publishedHtml: string;
}

export class ReadService {
  constructor(private readonly prisma: PrismaClient) {}

  public async read(slug: string, userId?: string): Promise<ReadingView> {
    const post = await this.prisma.post.findFirst({
      where: {
        slug,
        deletedAt: null,
        publishedAt: { not: null },
      },
      select: {
        id: true,
        author: { select: publicSelect },
        publishedTitle: true,
        publishedHtml: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    if (!post) throw new PostNotFoundError();

    if (userId) {
      await this.prisma.view.create({
        data: {
          userId,
          postId: post.id,
          type: 'OPENED',
        },
      });
    }

    return {
      id: post.id,
      author: flattenAvatarKey(post.author),
      title: post.publishedTitle!,
      publishedHtml: post.publishedHtml!,
      likes: post._count.likes,
      comments: post._count.comments,
    };
  }
}
