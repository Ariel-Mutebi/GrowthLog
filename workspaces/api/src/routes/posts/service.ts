import type { PostSelect, PrismaClient } from '@growthlog/db';
import type { PostMetadata } from './schema.js';

const metadataSelector = {
  id: true,
  authorId: true,
  title: true,
  slug: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies PostSelect;

export class PostService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  public async create(authorId: string): Promise<PostMetadata> {
    return await this.prisma.post.create({
      data: {
        authorId,
        title: 'Untitled',
      },
      select: metadataSelector,
    });
  }
}
