import type { PostSelect, PostWhereInput, PrismaClient } from '@growthlog/db';
import type { PostMetadata, PostQueryOptions } from './schema.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

export class PostNotFoundError extends Error { };
export class SlugConflictError extends Error { };

const metadataSelector = {
  id: true,
  authorId: true,
  title: true,
  slug: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies PostSelect;

interface UpdateParams {
  authorId: string;
  postId: string;
  title?: string;
  slug?: string;
}

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

  public async update(params: UpdateParams): Promise<PostMetadata> {
    const { authorId, postId, ...data } = params;

    try {
      return await this.prisma.post.update({
        where: {
          authorId,
          id: postId,
        },
        data,
        select: metadataSelector,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new PostNotFoundError();
      }

      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new SlugConflictError();
      }

      throw error;
    }
  }

  public async getPost(authorId: string, postId: string): Promise<PostMetadata> {
    try {
      return await this.prisma.post.findUniqueOrThrow({
        where: {
          authorId,
          id: postId,
        },
        select: metadataSelector,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new PostNotFoundError();
      }

      throw error;
    }
  }

  public async getPosts(authorId: string, options: PostQueryOptions): Promise<PostMetadata[]> {
    const { sortBy = 'updatedAt', order = 'asc', published } = options;

    const where: PostWhereInput = { authorId };

    if (published !== undefined) {
      where.publishedAt = published ? { not: null } : null;
    }

    return await this.prisma.post.findMany({
      where,
      select: metadataSelector,
      orderBy: [
        { [sortBy]: order },
        { id: 'asc' }, // tiebreaker so ordering is deterministic
      ],
    });
  }
}
