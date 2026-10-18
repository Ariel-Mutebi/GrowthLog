import { randomInt } from 'node:crypto';
import { PrismaClientKnownRequestError } from '@growthlog/db';
import { PostNotFoundError } from './shared/errors.js';
import type { PostWhereInput, PrismaClient } from '@growthlog/db';

export interface DraftMetadata {
  id: string;
  title: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

const metadataSelector = {
  id: true,
  title: true,
  slug: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Record<keyof DraftMetadata, boolean>;

interface DraftQueryOptions {
  sortBy: 'title' | 'updatedAt';
  order: 'asc' | 'desc';
  published: boolean;
}

export class DraftService {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  async create(authorId: string): Promise<DraftMetadata> {
    return await this.prisma.post.create({
      data: {
        authorId,
        title: 'Untitled',
        slug: `untitled-${randomInt(1000, 10000)}`,
      },
      select: metadataSelector,
    });
  }

  async update(authorId: string, postId: string, title: string): Promise<DraftMetadata> {
    try {
      return await this.prisma.post.update({
        where: {
          authorId,
          id: postId,
          deletedAt: null,
        },
        data: {
          title,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new PostNotFoundError();
      }

      throw error;
    }
  }

  async getDraft(authorId: string, id: string): Promise<DraftMetadata> {
    const draft = await this.prisma.post.findUnique({
      where: {
        id,
        authorId,
        deletedAt: null,
      },
      select: metadataSelector,
    });

    if (!draft) throw new PostNotFoundError();

    return draft;
  }

  async getDrafts(authorId: string, options: Partial<DraftQueryOptions>): Promise<DraftMetadata[]> {
    const { sortBy = 'updatedAt', order = 'asc', published } = options;
    const where: PostWhereInput = { authorId, deletedAt: null };

    if (published !== undefined) {
      where.publishedAt = published ? { not: null } : null;
    }

    return await this.prisma.post.findMany({
      where,
      select: metadataSelector,
      orderBy: [{ [sortBy]: order }],
    });
  }

  async deleteDraft(authorId: string, postId: string): Promise<void> {
    try {
      await this.prisma.post.update({
        where: {
          authorId,
          id: postId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
        select: metadataSelector,
      });
    } catch (error) {
      if (error  instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        return;
      }
      throw error;
    }
  }
}
